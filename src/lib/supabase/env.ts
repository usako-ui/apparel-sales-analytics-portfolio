// 公開してよい Supabase の設定（URL と anon キー）を読む。service role キーはここでは扱わない
// NEXT_PUBLIC_ の変数は、ブラウザ用にビルド時に文字列へ置き換えられるため、process.env.名前 をそのまま書く
export function getPublicSupabaseEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // 足りない変数の名前だけを出す（値は出さない）
  if (!url) throw new Error("環境変数がありません：NEXT_PUBLIC_SUPABASE_URL（.env.local を確認）");
  if (!anonKey) throw new Error("環境変数がありません：NEXT_PUBLIC_SUPABASE_ANON_KEY（.env.local を確認）");
  return { url, anonKey };
}
