// 本人の profiles の更新（service role）。本人に profiles の update を許すと role を書き換えられるため、
// サーバー側から、確認済みの userId に対してだけ行う（architecture.md 第17項3 の ②③）
// 呼んでよい場所：requireMember() の後、またはログインに成功した直後の Server Action だけ
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// ログイン成功時：最終ログイン日時を記録する。失敗してもログイン自体は止めない（記録だけの情報のため）
export async function recordLastLogin(userId: string): Promise<void> {
  const { error } = await createAdminClient()
    .from("profiles")
    .update({ last_login_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) console.error("最終ログイン日時を更新できませんでした");
}

// パスワード変更後：一時パスワードの印を外す。失敗したら呼び出し側に知らせる
export async function clearMustChangePassword(userId: string): Promise<boolean> {
  const { error, data } = await createAdminClient()
    .from("profiles")
    .update({ must_change_password: false })
    .eq("user_id", userId)
    .select("user_id");
  return !error && (data?.length ?? 0) === 1;
}
