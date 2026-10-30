// Next.js 16 の proxy（旧 middleware）。やることは2つだけ（architecture.md 第17項1）：
//   ① getClaims() でセッションを更新し、新しい Cookie をリクエストとレスポンスの両方に書き戻す
//   ② 未ログインなら /login へ移す（楽観的な確認。認可そのものは lib/auth/guard.ts が毎回行う）
// getSession() はサーバーで信用しない。ここでは JWT の署名を確かめる getClaims() を使う
import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getPublicSupabaseEnv } from "@/lib/supabase/env";

// ログインしていなくても開けるパス（/auth/ はサインアウトして /login へ戻す Route Handler）
function isPublicPath(pathname: string): boolean {
  return pathname === "/login" || pathname.startsWith("/auth/");
}

export async function proxy(request: NextRequest) {
  const { url, anonKey } = getPublicSupabaseEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        // 更新されたセッションを、この後の描画（request）と、ブラウザへの応答（response）の両方に渡す
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  if (!signedIn && !isPublicPath(request.nextUrl.pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    const redirectResponse = NextResponse.redirect(loginUrl);
    // 期限切れのセッションを消す Cookie などを、リダイレクトにも引き継ぐ
    for (const cookie of response.cookies.getAll()) redirectResponse.cookies.set(cookie);
    return redirectResponse;
  }

  return response;
}

export const config = {
  // 静的ファイル（_next の配信物・画像・favicon）は除外する
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
