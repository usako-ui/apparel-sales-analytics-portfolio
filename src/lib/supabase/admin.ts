// service role（管理用キー）の Supabase クライアント。RLS を迂回するため、サーバー側だけで使う
// 絶対に隠すキー：SUPABASE_SERVICE_ROLE_KEY（漏れると全データを読み書きされる）
// 使ってよい場面（architecture.md 第17項3）：
//   ① requireAdmin() を通った後の管理者処理
//   ② 本人のパスワード変更後の must_change_password=false
//   ③ last_login_at の更新
// "server-only" により、Client Component から import するとビルドエラーになる
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // 足りない変数の名前だけを出す（値は出さない）
  if (!url) throw new Error("環境変数がありません：NEXT_PUBLIC_SUPABASE_URL（.env.local を確認）");
  if (!serviceRoleKey) throw new Error("環境変数がありません：SUPABASE_SERVICE_ROLE_KEY（.env.local を確認）");

  return createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
}
