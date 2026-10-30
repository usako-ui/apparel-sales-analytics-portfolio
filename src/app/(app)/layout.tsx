import { Suspense } from "react";
import { AppShell } from "@/components/layout/AppShell";

// ログイン後の共通レイアウト：PC は左のメニュー、スマホは下のタブ
// 注意：レイアウトは画面を移動しても描画し直されないため、ここは「表示」だけ。
//       認可は各ページ・各 Server Action が requireMember()／requireAdmin() で毎回行う。
//       セッションを読むページは、自分の中で <Suspense> を持つ（Cache Components の決まり）
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<aside className="fixed inset-y-0 left-0 hidden w-sidebar bg-brand-navy md:block" />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
