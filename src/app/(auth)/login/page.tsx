import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import { Logo } from "@/components/layout/Logo";
import { AlertMessage } from "@/components/ui/AlertMessage";
import { SUSPENDED_MESSAGE } from "@/lib/auth/access";
import { type AccountResult, resolveAccount } from "@/lib/auth/account";
import { createClient } from "@/lib/supabase/server";

// ログイン画面。searchParams・ログイン状態は実行時の値なので、Suspense の中で読む
export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-10">
      <Logo tone="onLight" />
      <div className="flex w-full max-w-sm flex-col gap-5 rounded-card border border-line bg-surface p-6 shadow-card">
        <h1 className="text-center text-heading font-bold text-brand-navy">ログイン</h1>
        <Suspense fallback={null}>
          <LoginStatus searchParams={searchParams} />
        </Suspense>
        <LoginForm />
        <p className="text-center text-caption text-ink-muted">パスワードを忘れた方は管理者に連絡してください</p>
      </div>
    </main>
  );
}

// ログイン済みで有効な人は、ログイン画面を見せずに移す（判定は guard と同じ resolveAccount の結果）。
// 停止中の人は移さず、案内を出す。proxy は「ログイン済みか」を見るだけの楽観的な確認のまま
async function LoginStatus({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  await connection();
  let result: AccountResult | null = null;
  try {
    result = await resolveAccount(await createClient());
  } catch {
    // 状態を確認できなくても、ログイン画面自体は開けるようにする（移動も案内もしない）
  }
  if (result?.status === "ok") redirect(result.account.mustChangePassword ? "/password" : "/");

  const { error } = await searchParams;
  if (result?.status === "suspended" || error === "suspended") return <AlertMessage>{SUSPENDED_MESSAGE}</AlertMessage>;
  return null;
}
