// ログイン中の人のアカウントを確かめる（Next.js に依存しない。クライアントを受け取るので結合テストでも使える）
// 「ログインしているか」→「profiles を本人の権限（RLS）で読む」→「状態を判定する」の順
import type { SupabaseClient } from "@supabase/supabase-js";
import { type AccountProfile, parseProfileRows } from "./access";

export type Account = AccountProfile & {
  userId: string;
  email: string | null;
};

export type AccountResult =
  | { status: "signedOut" }
  | { status: "suspended" }
  | { status: "ok"; account: Account };

export async function resolveAccount(supabase: SupabaseClient): Promise<AccountResult> {
  // getClaims：JWT の署名を確かめる。getSession() はサーバーでは信用しない
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return { status: "signedOut" };

  // 毎回読む（キャッシュしない）。休職・退職にした直後の次の操作から反映するため（AC-16）
  const { data: rows, error: readError } = await supabase
    .from("profiles")
    .select("shop_id, display_name, role, status, must_change_password")
    .eq("user_id", userId);

  // 読み取り自体の失敗（通信など）は「停止中」ではなく異常として止める（本人を誤ってログアウトさせない）。
  // 通さないので安全側。詳細は出さない
  if (readError) throw new Error("アカウント情報の確認に失敗しました。時間をおいてもう一度お試しください");

  const parsed = parseProfileRows(rows);
  if (parsed.state === "suspended") return { status: "suspended" };

  const email = typeof data.claims.email === "string" ? data.claims.email : null;
  return { status: "ok", account: { ...parsed.profile, userId, email } };
}
