// 管理者画面のメンバー一覧を読む（表示専用）。呼ぶのは requireAdmin() を通った後の admin/page.tsx だけ
// メールアドレスは Auth 側にしかないため、service role（サーバー側だけ）で読む。自分のお店の人だけに絞る
import "server-only";
import type { MemberView } from "@/components/admin/member-types";
import type { AccountStatus, MemberRole } from "@/components/ui/Badge";
import { createAdminClient } from "@/lib/supabase/admin";

const ROLES: MemberRole[] = ["admin", "operator"];
const STATUSES: AccountStatus[] = ["active", "leave", "retired"];

// 日本時間の「YYYY/MM/DD HH:mm」。サーバーで文字にしてから画面へ渡す（ブラウザの地域設定でずれないため）
export function formatDateTime(iso: string | null): string {
  if (!iso) return "未ログイン";
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}/${get("month")}/${get("day")} ${get("hour")}:${get("minute")}`;
}

export async function loadMembers(shopId: string): Promise<MemberView[]> {
  const db = createAdminClient();

  const { data: profiles, error } = await db
    .from("profiles")
    .select("user_id, display_name, role, status, last_login_at")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: true });
  if (error || !profiles) throw new Error("メンバー一覧を読み込めませんでした。時間をおいてもう一度お試しください");

  // メールアドレス：Auth のユーザー一覧から、自分のお店の人の分だけ取り出す（少人数なので順に読む）
  const emails = new Map<string, string>();
  for (let page = 1; page <= 20; page++) {
    const { data, error: listError } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (listError || !data) throw new Error("メンバー一覧を読み込めませんでした。時間をおいてもう一度お試しください");
    for (const user of data.users) emails.set(user.id, user.email ?? "");
    if (data.users.length < 1000) break;
  }

  return profiles
    .filter((p) => ROLES.includes(p.role) && STATUSES.includes(p.status))
    .map((p) => ({
      userId: p.user_id as string,
      displayName: p.display_name as string,
      email: emails.get(p.user_id as string) ?? "",
      role: p.role as MemberRole,
      status: p.status as AccountStatus,
      lastLoginLabel: formatDateTime((p.last_login_at as string | null) ?? null),
    }));
}
