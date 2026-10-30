import { BarChart3, CloudUpload, Settings, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type MenuItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  // true の項目は管理者にだけ表示する（表示を隠すだけ。URL直打ちの守りはサーバー側の requireAdmin）
  adminOnly?: boolean;
  // スマホの下タブの文字（幅が狭いので短くする）。なければ label を使う
  shortLabel?: string;
};

// 左のメニュー（PC）と下のタブ（スマホ）が同じ一覧を使う。項目の追加・変更はここだけ
export const menuItems: MenuItem[] = [
  { href: "/", label: "ダッシュボード", icon: BarChart3 },
  { href: "/upload", label: "CSVアップロード", shortLabel: "アップロード", icon: CloudUpload },
  { href: "/admin", label: "管理者", icon: Settings, adminOnly: true },
  // スマホでは「アカウント」タブ。開いた画面の下にログアウトのボタンがある
  { href: "/password", label: "パスワード変更", shortLabel: "アカウント", icon: UserRound },
];

// 管理者でなければ「管理者」を除く。
// 一時パスワードのままの間は、メニュー自体を出さない（AppShell で描画しない。押しても戻されるだけのため）
export function visibleMenuItems(isAdmin: boolean): MenuItem[] {
  return menuItems.filter((item) => isAdmin || !item.adminOnly);
}

// 今開いている画面か（"/" は完全一致、ほかは配下も含める）
export function isActivePath(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
