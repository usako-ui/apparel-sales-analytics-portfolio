"use client";

import { Lock, Mail } from "lucide-react";
import { useActionState } from "react";
import { login } from "@/actions/account";
import { AlertMessage } from "@/components/ui/AlertMessage";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";

// ログインのフォーム。処理（login）とエラー文は actions/account.ts のものをそのまま使う
export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <TextField
        label="メールアドレス"
        hideLabel
        icon={Mail}
        name="email"
        type="email"
        placeholder="メールアドレス"
        autoComplete="username"
        required
      />
      <TextField
        label="パスワード"
        hideLabel
        icon={Lock}
        name="password"
        type="password"
        placeholder="パスワード"
        autoComplete="current-password"
        required
      />
      {state?.error ? <AlertMessage>{state.error}</AlertMessage> : null}
      <Button type="submit" fullWidth disabled={pending}>
        {pending ? "ログイン中…" : "ログイン"}
      </Button>
    </form>
  );
}
