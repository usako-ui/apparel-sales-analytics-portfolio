// ログインが切れているかを、画面側で確かめる（T-27 No.3）。
// ログインが切れた状態で Server Action を呼ぶと、proxy.ts が /login へ移すため、画面側では「想定外の応答」で失敗する。
// 失敗の原因が通信ではなくログイン切れかを、保護されたページ（/upload）をもう一度開いて確かめる：
// ログインが切れていれば proxy が /login へ移すので、移った先が /login なら「ログイン切れ」。
// proxy.ts の動きは変えない（楽観的な確認のまま）。通信そのものが失敗している時は、確かめも失敗するので false を返す
export async function isSignedOut(): Promise<boolean> {
  try {
    const response = await fetch("/upload", { credentials: "same-origin", cache: "no-store" });
    return response.redirected && new URL(response.url).pathname === "/login";
  } catch {
    return false;
  }
}
