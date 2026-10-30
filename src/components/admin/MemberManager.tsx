"use client";

import { KeyRound, Plus, Users } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { changeRole, changeStatus, createMember, editMember, reissuePassword } from "@/actions/admin";
import { PageHeader } from "@/components/layout/PageHeader";
import { AlertMessage } from "@/components/ui/AlertMessage";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { SuccessMessage } from "@/components/ui/SuccessMessage";
import {
  AddMemberForm,
  EditMemberForm,
  ReissueConfirm,
  RoleForm,
  StatusForm,
  TemporaryPasswordView,
} from "./MemberForms";
import { MemberList } from "./MemberList";
import type { MemberView } from "./member-types";

type Props = { members: MemberView[]; currentUserId: string };

// 開いているダイアログ。一時パスワードは "password" のときだけ状態に持ち、閉じたら消す（画面に残さない）
type DialogState =
  | { kind: "add" }
  | { kind: "menu"; member: MemberView }
  | { kind: "edit"; member: MemberView }
  | { kind: "role"; member: MemberView }
  | { kind: "status"; member: MemberView }
  | { kind: "reissue"; member: MemberView }
  | { kind: "password"; password: string; note: string; warning?: string }
  | null;

type Result = { ok: true; warning?: string } | { ok: false; error: string };

const NETWORK_ERROR = "通信に失敗しました。接続を確かめてから、もう一度お試しください。";

function titleOf(dialog: NonNullable<DialogState>): string {
  switch (dialog.kind) {
    case "add": return "メンバーを追加";
    case "menu": return `${dialog.member.displayName}さんの操作`;
    case "edit": return "名前・メールアドレスの編集";
    case "role": return "ロールの変更";
    case "status": return "状態の変更";
    case "reissue": return "一時パスワードの再発行";
    case "password": return "一時パスワード";
  }
}

export function MemberManager({ members, currentUserId }: Props) {
  const [dialog, setDialog] = useState<DialogState>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; warning?: string } | null>(null);
  const [busy, startTransition] = useTransition();
  const runningRef = useRef(false);

  function open(next: DialogState) {
    setError(null);
    setNotice(null);
    setDialog(next);
  }

  // 閉じる。一時パスワードを持つ状態もここで消える
  function close() {
    setError(null);
    setDialog(null);
  }

  // サーバーの処理を呼ぶ。失敗はダイアログ内に出し、成功したら onSuccess へ
  // 処理中は何もしない（連打で2回呼ばれ、画面の一時パスワードとサーバーで有効なものがずれるのを防ぐ）。
  // busy は次の描画まで変わらないため、同じ描画の中の連続呼び出しは ref で止める
  function run<R extends Result>(call: () => Promise<R>, onSuccess: (result: Extract<R, { ok: true }>) => void) {
    if (runningRef.current) return;
    runningRef.current = true;
    setError(null);
    startTransition(async () => {
      try {
        const result = await call();
        if (!result.ok) {
          setError(result.error);
          return;
        }
        onSuccess(result as Extract<R, { ok: true }>);
      } catch {
        setError(NETWORK_ERROR);
      } finally {
        runningRef.current = false;
      }
    });
  }

  function finish(text: string, warning?: string) {
    setDialog(null);
    setNotice({ text, warning });
  }

  const renderBody = (d: NonNullable<DialogState>) => {
    switch (d.kind) {
      case "add":
        return (
          <AddMemberForm
            busy={busy}
            error={error}
            onCancel={close}
            onSubmit={(values) =>
              run(
                () => createMember(values),
                (r) => {
                  setDialog({
                    kind: "password",
                    password: r.temporaryPassword,
                    note: `${values.displayName}さんを追加しました。この一時パスワードでログインし、新しいパスワードを設定してもらいます。本人に直接伝えてください。`,
                    warning: r.warning,
                  });
                },
              )
            }
          />
        );

      case "menu": {
        const m = d.member;
        const isSelf = m.userId === currentUserId;
        return (
          <div className="flex flex-col gap-2">
            <Button variant="secondary" onClick={() => open({ kind: "edit", member: m })}>名前・メールアドレスを編集</Button>
            {isSelf ? (
              <p className="text-caption text-ink-muted">
                自分自身の状態・ロールの変更と、一時パスワードの再発行はできません。自分のパスワードは、メニューの「パスワード変更」から変更してください。
              </p>
            ) : (
              <>
                <Button variant="secondary" onClick={() => open({ kind: "role", member: m })}>ロールを変更</Button>
                <Button variant="secondary" onClick={() => open({ kind: "status", member: m })}>状態を変更</Button>
                <Button variant="secondary" onClick={() => open({ kind: "reissue", member: m })}>
                  <KeyRound aria-hidden="true" className="size-4" />
                  一時パスワードを再発行
                </Button>
              </>
            )}
          </div>
        );
      }

      case "edit":
        return (
          <EditMemberForm
            member={d.member}
            busy={busy}
            error={error}
            onCancel={close}
            onSubmit={(values) =>
              run(
                () => editMember({ targetId: d.member.userId, ...values }),
                (r) => finish(`${d.member.displayName}さんの情報を変更しました。`, r.warning),
              )
            }
          />
        );

      case "role":
        return (
          <RoleForm
            member={d.member}
            busy={busy}
            error={error}
            onCancel={close}
            onSubmit={(role) =>
              run(
                () => changeRole({ targetId: d.member.userId, role }),
                (r) => finish(`${d.member.displayName}さんのロールを${role === "admin" ? "管理者" : "操作者"}に変更しました。`, r.warning),
              )
            }
          />
        );

      case "status":
        return (
          <StatusForm
            member={d.member}
            busy={busy}
            error={error}
            onCancel={close}
            onSubmit={(status) =>
              run(
                () => changeStatus({ targetId: d.member.userId, status }),
                (r) => {
                  const label = status === "active" ? "有効" : status === "leave" ? "休職" : "退職";
                  if (r.temporaryPassword) {
                    setDialog({
                      kind: "password",
                      password: r.temporaryPassword,
                      note: `${d.member.displayName}さんを有効に戻しました。この一時パスワードでログインし、新しいパスワードを設定してもらいます。本人に直接伝えてください。`,
                      warning: r.warning,
                    });
                  } else {
                    finish(`${d.member.displayName}さんの状態を${label}に変更しました。`, r.warning);
                  }
                },
              )
            }
          />
        );

      case "reissue":
        return (
          <ReissueConfirm
            member={d.member}
            busy={busy}
            error={error}
            onCancel={close}
            onConfirm={() =>
              run(
                () => reissuePassword({ targetId: d.member.userId }),
                (r) =>
                  setDialog({
                    kind: "password",
                    password: r.temporaryPassword,
                    note: `${d.member.displayName}さんの一時パスワードを再発行しました。本人に直接伝えてください。`,
                    warning: r.warning,
                  }),
              )
            }
          />
        );

      case "password":
        return <TemporaryPasswordView password={d.password} note={d.note} warning={d.warning} onClose={close} />;
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="管理者"
        description="メンバーの管理を行います"
        action={
          <Button variant="secondary" onClick={() => open({ kind: "add" })}>
            <Plus aria-hidden="true" className="size-4" />
            メンバー追加
          </Button>
        }
      />

      {notice ? (
        <div className="flex flex-col gap-2">
          <SuccessMessage>{notice.text}</SuccessMessage>
          {notice.warning ? <AlertMessage>{notice.warning}</AlertMessage> : null}
        </div>
      ) : null}

      <section aria-labelledby="member-list-title" className="flex flex-col gap-3">
        <h2 id="member-list-title" className="flex items-center gap-2 text-heading font-bold text-brand-navy">
          <Users aria-hidden="true" className="size-5" />
          メンバー一覧
        </h2>
        <MemberList members={members} currentUserId={currentUserId} onOperate={(member) => open({ kind: "menu", member })} />
      </section>

      <Dialog
        open={dialog !== null}
        onClose={close}
        title={dialog ? titleOf(dialog) : ""}
        icon={dialog?.kind === "password" ? <KeyRound aria-hidden="true" className="size-5" /> : undefined}
      >
        {dialog ? renderBody(dialog) : null}
      </Dialog>
    </div>
  );
}
