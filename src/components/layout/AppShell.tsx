import type { ReactNode } from "react";
import { requireMember } from "@/lib/auth/guard";
import { SideMenu } from "./SideMenu";
import { TabBar } from "./TabBar";

// ログイン後の枠：メニュー（PC＝左・スマホ＝下）と内容。セッションを読むので、呼び出し側で <Suspense> の中に置く
// 役割は guard の結果をそのまま渡す（ここで権限を判断し直さない）。
// 管理者の項目を隠すのは表示だけで、守りは各画面・各 Server Action の requireAdmin()
export async function AppShell({ children }: { children: ReactNode }) {
  const member = await requireMember({ onPasswordPage: true });

  // 一時パスワードのままの間は /password 以外を使えないので、メニューを出さない（内容だけ）
  if (member.mustChangePassword) {
    return <div className="flex flex-1 flex-col">{children}</div>;
  }

  const isAdmin = member.role === "admin";
  return (
    <>
      <SideMenu isAdmin={isAdmin} />
      <TabBar isAdmin={isAdmin} />
      {/* メニューの分だけ内容をずらす（PC：左・スマホ：下） */}
      <div className="flex flex-1 flex-col pb-tabbar md:pb-0 md:pl-sidebar">{children}</div>
    </>
  );
}
