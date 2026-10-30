// Supabase Auth のエラーの種類の見分け方（ログイン・パスワード変更で共通）
// 400・422 は入力の違い（メール・パスワードの違い、弱いパスワードなど）。
// それ以外（429 のログイン回数の上限、500 系、通信の失敗で status がないなど）は、
// 入力のせいではないので「しばらくしてから、もう一度お試しください」と案内する
export const RETRY_LATER_MESSAGE = "しばらくしてから、もう一度お試しください。";

export function isCredentialError(error: { status?: number | null }): boolean {
  return error.status === 400 || error.status === 422;
}
