"use client";

import { Lock } from "lucide-react";
import { useActionState } from "react";
import { changePassword } from "@/actions/account";
import { AlertMessage } from "@/components/ui/AlertMessage";
import { Button } from "@/components/ui/Button";
import { SuccessMessage } from "@/components/ui/SuccessMessage";
import { TextField } from "@/components/ui/TextField";

type Props = {
  // 一時パスワードでの初回ログイン中は true（最初の欄の名前が「一時パスワード」になる）
  mustChange: boolean;
};

// パスワード変更のフォーム。処理（changePassword）とエラー文は actions/account.ts のものをそのまま使う
export function PasswordForm({ mustChange }: Props) {
  const [state, action, pending] = useActionState(changePassword, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <TextField
        label={mustChange ? "一時パスワード" : "現在のパスワード"}
        icon={Lock}
        name="currentPassword"
        type="password"
        autoComplete="current-password"
        required
      />
      <TextField
        label="新しいパスワード"
        hint="8文字以上で入力してください"
        icon={Lock}
        name="newPassword"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
      />
      <TextField
        label="新しいパスワード（確認用）"
        icon={Lock}
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
      />
      {state?.error ? <AlertMessage>{state.error}</AlertMessage> : null}
      {state?.message ? <SuccessMessage>{state.message}</SuccessMessage> : null}
      <Button type="submit" fullWidth disabled={pending}>
        {pending ? "変更中…" : "変更する"}
      </Button>
    </form>
  );
}
