import type { AccountStatus, MemberRole } from "@/components/ui/Badge";

// 管理者画面の1人分の表示用データ（サーバーで作り、画面へ渡す）
export type MemberView = {
  userId: string;
  displayName: string;
  email: string;
  role: MemberRole;
  status: AccountStatus;
  lastLoginLabel: string; // 「2026/10/26 09:24」の形（日本時間）。未ログインは「未ログイン」
};

// 状態の変更で選べる行き先。退職からは休職に戻せない（有効にするときは一時パスワードが再発行される）
export function allowedStatuses(current: AccountStatus): AccountStatus[] {
  if (current === "active") return ["leave", "retired"];
  if (current === "leave") return ["active", "retired"];
  return ["active"];
}
