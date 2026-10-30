// ブラウザ（Client Component）で使う Supabase クライアント
// 使うキーは anon キー（公開してよい）。service role キーは絶対にここへ入れない
import { createBrowserClient } from "@supabase/ssr";
import { getPublicSupabaseEnv } from "./env";

export function createClient() {
  const { url, anonKey } = getPublicSupabaseEnv();
  return createBrowserClient(url, anonKey);
}
