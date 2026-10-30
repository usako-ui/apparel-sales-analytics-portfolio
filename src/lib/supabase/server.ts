// サーバー側（Server Component・Server Action・Route Handler）で使う Supabase クライアント
// 使うキーは anon キー（公開してよい）。ログイン中の人の権限（RLS）で動く
import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createPlainClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getPublicSupabaseEnv } from "./env";

// リクエストごとに新しく作る（共有しない）
export async function createClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  const { url, anonKey } = getPublicSupabaseEnv();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component の描画中は Cookie を書けない。セッションの更新は proxy.ts が行う
        }
      },
    },
  });
}

// セッションを保存しない anon クライアント。「現在のパスワードの確認」のように、
// ログイン中のセッション（Cookie）に影響させずにパスワードだけ確かめたいときに使う
export function createStatelessClient(): SupabaseClient {
  const { url, anonKey } = getPublicSupabaseEnv();
  return createPlainClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
}
