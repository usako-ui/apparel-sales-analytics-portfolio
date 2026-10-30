// 「分析を生成」を実行して、画面に出す結果にそろえる（T-35）。
// Server Action が例外で終わった時（通信の失敗・ログイン切れ）も、画面が壊れないよう日本語の案内にする
import { isSignedOut } from "@/components/upload/session-check";

export const NETWORK_ERROR = "通信に失敗しました。接続を確かめてから、もう一度生成してください。";
export const SIGNED_OUT_ERROR = "ログインの有効期限が切れました。もう一度ログインしてください。";

// Server Action の戻り値のうち、画面が使う部分だけ（generateAnalysisAction はこれを満たす）
export type GenerateActionResult = { ok: true } | { ok: false; message: string };

export type GenerateOutcome = { ok: true } | { ok: false; message: string; signedOut: boolean };

export async function requestAnalysis(
  month: string,
  action: (month: string) => Promise<GenerateActionResult>,
  checkSignedOut: () => Promise<boolean> = isSignedOut,
): Promise<GenerateOutcome> {
  try {
    const result = await action(month);
    // 失敗の message は日本語の案内として、そのまま出す
    return result.ok ? { ok: true } : { ok: false, message: result.message, signedOut: false };
  } catch {
    const signedOut = await checkSignedOut();
    return { ok: false, message: signedOut ? SIGNED_OUT_ERROR : NETWORK_ERROR, signedOut };
  }
}
