"use client";

import { Check, Copy, Mail, UserRound } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import type { AccountStatus, MemberRole } from "@/components/ui/Badge";
import { AlertMessage } from "@/components/ui/AlertMessage";
import { Button } from "@/components/ui/Button";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { allowedStatuses, type MemberView } from "./member-types";

// ダイアログの中身（フォームと確認）。通信はせず、入力を親（MemberManager）へ渡すだけ
// busy：処理中／error：サーバーから返ったエラー文

type CommonProps = { busy: boolean; error: string | null; onCancel: () => void };

const ROLE_OPTIONS = [
  { value: "operator", label: "操作者" },
  { value: "admin", label: "管理者" },
] as const;

const STATUS_LABEL: Record<AccountStatus, string> = { active: "有効", leave: "休職", retired: "退職" };

function Actions({ busy, onCancel, submitLabel }: { busy: boolean; onCancel: () => void; submitLabel: string }) {
  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button variant="secondary" onClick={onCancel} disabled={busy}>
        キャンセル
      </Button>
      <Button type="submit" disabled={busy}>
        {busy ? "処理中…" : submitLabel}
      </Button>
    </div>
  );
}

// ---- メンバー追加 -----------------------------------------------------

export function AddMemberForm({
  busy,
  error,
  onCancel,
  onSubmit,
}: CommonProps & { onSubmit: (values: { displayName: string; email: string; role: MemberRole }) => void }) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("operator");

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit({ displayName, email, role });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <TextField label="名前" icon={UserRound} value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={50} required />
      <TextField label="メールアドレス" icon={Mail} type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} required />
      <SelectField label="ロール" value={role} onChange={(e) => setRole(e.target.value as MemberRole)} options={ROLE_OPTIONS} />
      <p className="text-caption text-ink-muted">追加すると、一時パスワードが1回だけ表示されます。本人に直接伝えてください。</p>
      {error ? <AlertMessage>{error}</AlertMessage> : null}
      <Actions busy={busy} onCancel={onCancel} submitLabel="追加する" />
    </form>
  );
}

// ---- 名前・メールアドレスの編集（メールが変わるときは確認を挟む） --------

export function EditMemberForm({
  member,
  busy,
  error,
  onCancel,
  onSubmit,
}: CommonProps & {
  member: MemberView;
  onSubmit: (values: { displayName?: string; email?: string }) => void;
}) {
  const [displayName, setDisplayName] = useState(member.displayName);
  const [email, setEmail] = useState(member.email);
  const [confirming, setConfirming] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const nameChanged = displayName.trim() !== member.displayName;
  const emailChanged = email.trim().toLowerCase() !== member.email.toLowerCase();

  function send() {
    onSubmit({
      ...(nameChanged ? { displayName } : {}),
      ...(emailChanged ? { email } : {}),
    });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!nameChanged && !emailChanged) {
      setLocalError("変更する内容がありません。内容を変えてから、もう一度お試しください。");
      return;
    }
    setLocalError(null);
    // メールアドレスはログインIDなので、変えるときは確認する
    if (emailChanged) setConfirming(true);
    else send();
  }

  if (confirming) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-body">
          メールアドレスはログインに使うIDです。変更すると、{member.displayName}さんは新しいメールアドレスでログインします。
        </p>
        <dl className="flex flex-col gap-1 rounded-control bg-brand-light p-3 text-body">
          <div className="flex gap-2"><dt className="shrink-0 text-ink-muted">変更前</dt><dd className="break-all">{member.email}</dd></div>
          <div className="flex gap-2"><dt className="shrink-0 text-ink-muted">変更後</dt><dd className="break-all font-semibold">{email.trim().toLowerCase()}</dd></div>
        </dl>
        {error ? <AlertMessage>{error}</AlertMessage> : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>
            戻る
          </Button>
          <Button onClick={send} disabled={busy}>
            {busy ? "処理中…" : "変更する"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <TextField label="名前" icon={UserRound} value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={50} required />
      <TextField label="メールアドレス" icon={Mail} type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} required />
      {localError || error ? <AlertMessage>{localError ?? error ?? ""}</AlertMessage> : null}
      <Actions busy={busy} onCancel={onCancel} submitLabel="保存する" />
    </form>
  );
}

// ---- ロールの変更 -----------------------------------------------------

export function RoleForm({
  member,
  busy,
  error,
  onCancel,
  onSubmit,
}: CommonProps & { member: MemberView; onSubmit: (role: MemberRole) => void }) {
  const [role, setRole] = useState<MemberRole>(member.role);

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit(role);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <SelectField label={`${member.displayName}さんのロール`} value={role} onChange={(e) => setRole(e.target.value as MemberRole)} options={ROLE_OPTIONS} />
      <p className="text-caption text-ink-muted">管理者は、管理者画面でメンバーの管理ができます。操作者は、管理者画面を使えません。</p>
      {error ? <AlertMessage>{error}</AlertMessage> : null}
      <Actions busy={busy} onCancel={onCancel} submitLabel="変更する" />
    </form>
  );
}

// ---- 状態の変更（選ぶ → 説明を読む → 変更する。確認を兼ねる） -----------

function statusExplanation(from: AccountStatus, to: AccountStatus, name: string): string {
  if (to === "leave") return `休職にすると、${name}さんはログインできなくなります。有効に戻すと、パスワードはそのまま使えます。`;
  if (to === "retired") return `退職にすると、${name}さんはログインできなくなります。データは削除されません。`;
  if (from === "retired") {
    return `有効に戻します。一時パスワードも再発行されます。次の画面で1回だけ表示されるので、${name}さんに直接伝えてください。`;
  }
  return `有効に戻します。${name}さんは、これまでのパスワードでログインできます。`;
}

export function StatusForm({
  member,
  busy,
  error,
  onCancel,
  onSubmit,
}: CommonProps & { member: MemberView; onSubmit: (status: AccountStatus) => void }) {
  const options = allowedStatuses(member.status);
  const [status, setStatus] = useState<AccountStatus>(options[0]);

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit(status);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <p className="text-body">
        {member.displayName}さんの状態：<strong>{STATUS_LABEL[member.status]}</strong>
      </p>
      <SelectField
        label="変更後の状態"
        value={status}
        onChange={(e) => setStatus(e.target.value as AccountStatus)}
        options={options.map((value) => ({ value, label: STATUS_LABEL[value] }))}
      />
      <p className="rounded-control bg-brand-light p-3 text-body">{statusExplanation(member.status, status, member.displayName)}</p>
      {error ? <AlertMessage>{error}</AlertMessage> : null}
      <Actions busy={busy} onCancel={onCancel} submitLabel="変更する" />
    </form>
  );
}

// ---- 一時パスワードの再発行（確認） -----------------------------------

export function ReissueConfirm({
  member,
  busy,
  error,
  onCancel,
  onConfirm,
}: CommonProps & { member: MemberView; onConfirm: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-body">
        {member.displayName}さんの一時パスワードを再発行します。今のパスワードは使えなくなり、次にログインするときにパスワードの変更が必要です。
      </p>
      {error ? <AlertMessage>{error}</AlertMessage> : null}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          キャンセル
        </Button>
        <Button onClick={onConfirm} disabled={busy}>
          {busy ? "処理中…" : "再発行する"}
        </Button>
      </div>
    </div>
  );
}

// ---- 一時パスワードの表示（1回だけ） ----------------------------------

export function TemporaryPasswordView({
  password,
  note,
  warning,
  onClose,
}: {
  password: string;
  note: string;
  warning?: string;
  onClose: () => void;
}) {
  const [copyState, setCopyState] = useState<"idle" | "done" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopyState("done");
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-body">{note}</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <p
          data-testid="temporary-password"
          className="flex-1 rounded-control border border-line-strong bg-brand-light px-3 py-3 text-center font-mono text-heading font-bold tracking-wider break-all text-brand-navy select-all"
        >
          {password}
        </p>
        <Button variant="secondary" onClick={copy}>
          {copyState === "done" ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
          {copyState === "done" ? "コピーしました" : "コピー"}
        </Button>
      </div>
      {copyState === "failed" ? (
        <AlertMessage>コピーできませんでした。表示されている文字を選んで、手動でコピーしてください。</AlertMessage>
      ) : null}
      <p className="text-body font-semibold text-down">この画面を閉じると二度と表示されません。</p>
      {warning ? <AlertMessage>{warning}</AlertMessage> : null}
      <div className="flex justify-end">
        <Button onClick={onClose}>閉じる</Button>
      </div>
    </div>
  );
}
