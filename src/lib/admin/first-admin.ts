// 最初の管理者を作る処理（architecture.md 第15項。納品時に開発者が手元で実行する）
// - Supabase のクライアントを引数で受け取る（テストでモックに差し替えるため）。server-only は import しない
// - Node がそのまま実行できるよう、相対パス＋ .ts 拡張子で import する（@/ の別名は使えない）
// - 一時パスワードは戻り値で返すだけ。DB・admin_logs・エラーメッセージには入れない
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateTemporaryPassword } from "./temp-password.ts";

export type FirstAdminInput = { shopName: string; email: string; displayName: string };

export type FirstAdminResult =
  | { ok: true; temporaryPassword: string; shopCreated: boolean }
  | { ok: false; reason: "invalid_input" | "admin_exists" | "email_exists"; message: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LIST_PER_PAGE = 1000;

// 想定外の失敗（通信・DB のエラー）は例外にする。メッセージには Supabase のエラー文だけを入れる
function fail(action: string, message: string): never {
  throw new Error(`${action}に失敗しました：${message}`);
}

export async function createFirstAdmin(client: SupabaseClient, input: FirstAdminInput): Promise<FirstAdminResult> {
  const shopName = input.shopName.trim();
  const email = input.email.trim();
  const displayName = input.displayName.trim();

  if (!shopName || !email || !displayName) {
    return { ok: false, reason: "invalid_input", message: "お店の名前・メールアドレス・表示名をすべて指定してください" };
  }
  if (!EMAIL_PATTERN.test(email)) {
    return { ok: false, reason: "invalid_input", message: "メールアドレスの形式が正しくありません" };
  }

  // 1. お店を探す。あれば、有効な管理者がいないか確認する（何かを作る前に）
  const { data: shops, error: shopFindError } = await client.from("shops").select("id").eq("name", shopName).limit(1);
  if (shopFindError) fail("お店の確認", shopFindError.message);
  let shopId: string | undefined = shops?.[0]?.id;

  if (shopId) {
    const { data: admins, error: adminFindError } = await client
      .from("profiles")
      .select("user_id")
      .eq("shop_id", shopId)
      .eq("role", "admin")
      .eq("status", "active")
      .limit(1);
    if (adminFindError) fail("管理者の確認", adminFindError.message);
    if (admins && admins.length > 0) {
      return { ok: false, reason: "admin_exists", message: "このお店にはすでに有効な管理者がいるため、何もしませんでした" };
    }
  }

  // 2. 同じメールのアカウントがないか確認する（上書きしない）
  const lowerEmail = email.toLowerCase();
  for (let page = 1; ; page++) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: LIST_PER_PAGE });
    if (error) fail("アカウント一覧の取得", error.message);
    if (data.users.some((user) => user.email?.toLowerCase() === lowerEmail)) {
      return { ok: false, reason: "email_exists", message: "このメールアドレスのアカウントがすでにあるため、何もしませんでした" };
    }
    if (data.users.length < LIST_PER_PAGE) break;
  }

  // 3. 作成：お店（なければ）→ Auth アカウント → profiles
  let shopCreated = false;
  if (!shopId) {
    const { data: created, error } = await client.from("shops").insert({ name: shopName }).select("id").single();
    if (error) fail("お店の作成", error.message);
    shopId = created.id as string;
    shopCreated = true;
  }

  const temporaryPassword = generateTemporaryPassword();
  const { data: authData, error: createError } = await client.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true, // メールは送らない
  });
  if (createError) fail("アカウントの作成", createError.message);
  const userId = authData.user.id;

  const { error: profileError } = await client.from("profiles").insert({
    user_id: userId,
    shop_id: shopId,
    display_name: displayName,
    role: "admin",
    status: "active",
    must_change_password: true,
  });
  if (profileError) {
    // 元に戻す：作った Auth アカウントを消す（profiles のない宙に浮いたアカウントを残さない）
    const { error: deleteError } = await client.auth.admin.deleteUser(userId);
    const rollback = deleteError
      ? "作成したアカウントの削除にも失敗しました。Supabase の管理画面で手動で削除してください"
      : "作成したアカウントは削除して元に戻しました";
    fail("profiles の登録", `${profileError.message}（${rollback}）`);
  }

  return { ok: true, temporaryPassword, shopCreated };
}
