import Link from "next/link";
import { Suspense } from "react";
import { logout } from "@/actions/account";
import { PasswordForm } from "@/components/auth/PasswordForm";
import { Logo } from "@/components/layout/Logo";
import { Button, buttonClass } from "@/components/ui/Button";
import { requireMember } from "@/lib/auth/guard";

// パスワード変更。一時パスワードのままの人が使える唯一の画面
export default function PasswordPage() {
  return (
    <Suspense fallback={<p className="p-4 text-body text-ink-muted">読み込み中…</p>}>
      <PasswordContent />
    </Suspense>
  );
}

async function PasswordContent() {
  const member = await requireMember({ onPasswordPage: true });
  const mustChange = member.mustChangePassword;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-10">
      {/* 初回はメニューがなく、ロゴもここにしか出ないため */}
      {mustChange ? <Logo tone="onLight" /> : null}
      <div className="flex w-full max-w-sm flex-col gap-5 rounded-card border border-line bg-surface p-6 shadow-card">
        <div className="flex flex-col gap-1 text-center">
          <h1 className="text-heading font-bold text-brand-navy">パスワード変更</h1>
          <p className="text-body text-ink-muted">
            {mustChange
              ? "一時パスワードでログインしています。新しいパスワードを設定するまで、ほかの画面は使えません。"
              : "新しいパスワードを入力してください"}
          </p>
        </div>
        <PasswordForm mustChange={mustChange} />
        {/* 初回：ログアウト／メニューから：キャンセル（ダッシュボードへ戻る） */}
        {mustChange ? (
          <form action={logout}>
            <Button type="submit" variant="ghost" fullWidth>
              ログアウト
            </Button>
          </form>
        ) : (
          <Link href="/" className={buttonClass("ghost", true)}>
            キャンセル
          </Link>
        )}
      </div>
      {/* スマホはメニューにログアウトがないので、この画面の下に置く（PC は左のメニューにある） */}
      {mustChange ? null : (
        <form action={logout} className="w-full max-w-sm md:hidden">
          <Button type="submit" variant="secondary" fullWidth>
            ログアウト
          </Button>
        </form>
      )}
    </main>
  );
}
