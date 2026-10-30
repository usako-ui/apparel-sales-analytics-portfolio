// 権限テスト用の補助。パスワード・キーは環境変数から受け取り、出力・エラー文に入れない
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function requireEnv(name: string): string {
  const value = process.env[name];
  // 変数名だけを出す（値は出さない）
  if (!value) throw new Error(`環境変数がありません：${name}（.env.local を確認）`);
  return value;
}

const noSession = { auth: { autoRefreshToken: false, persistSession: false } };

// 公開キー（anon）のクライアント。未ログインの状態
export function createAnonClient(): SupabaseClient {
  return createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), noSession);
}

// 管理用キー（service role）のクライアント。テストのサーバー側だけで使う（RLS を迂回する）
export function createServiceClient(): SupabaseClient {
  return createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), noSession);
}

// anon キーのクライアントでログインして返す
export async function signInAs(prefix: "TEST_ADMIN" | "TEST_OPERATOR" | "TEST_OTHER_SHOP"): Promise<SupabaseClient> {
  const client = createAnonClient();
  const { error } = await client.auth.signInWithPassword({
    email: requireEnv(`${prefix}_EMAIL`),
    password: requireEnv(`${prefix}_PASSWORD`),
  });
  // error.message は出さない（ステータスだけ）
  if (error) throw new Error(`ログインに失敗しました：${prefix}（status ${error.status ?? "不明"}）`);
  return client;
}

// テスト専用の月（本物の月と重ならない）
export const TEST_MONTH = "2099-01";

export function makeRow(day: string, sku: string, revenue: number, cost: number) {
  return {
    order_date: `${TEST_MONTH}-${day}`,
    customer_id: null,
    product_name: "RLSテスト商品",
    category: "テスト",
    sku,
    quantity: 1,
    revenue,
    cost,
  };
}
