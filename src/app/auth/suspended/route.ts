// 停止中（休職・退職など）のセッションをサインアウトして、ログイン画面へ戻す
// Cookie を消せるのは Route Handler・Server Action だけなので、guard.ts から redirect してここで処理する
//
// GET でサインアウトするため、他サイトの画像タグなどから開かれると、ログイン中の人が勝手にログアウトされる
// （ログアウト CSRF）。これを防ぐため、「本当に停止中」と確認できたときだけサインアウトする
import { type NextRequest, NextResponse } from "next/server";
import { resolveAccount } from "@/lib/auth/account";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const result = await resolveAccount(supabase);

  // 有効な人：何もしない（サインアウトしない）。一時パスワードのままなら guard が /password へ送る
  if (result.status === "ok") return NextResponse.redirect(new URL("/", request.url));
  // 未ログイン：ログイン画面へ
  if (result.status === "signedOut") return NextResponse.redirect(new URL("/login", request.url));

  // 停止中：この端末のセッションだけを終わらせる（local）
  await supabase.auth.signOut({ scope: "local" });
  return NextResponse.redirect(new URL("/login?error=suspended", request.url));
}
