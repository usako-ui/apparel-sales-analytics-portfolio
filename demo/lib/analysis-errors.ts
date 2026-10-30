// AI分析の失敗の案内（日本語）。状態コード → 文。入力したキーや Google の返答の原文は出さない
import { FAILURE_MESSAGE } from "@/lib/analysis/run";

const KEY_MESSAGE = "キーが正しくないようです。Google AI Studio で作ったキーを、もう一度入力してください。";
const LIMIT_MESSAGE = "Gemini の利用回数の上限に達しました。しばらく待ってから、もう一度お試しください。";
const SERVER_MESSAGE = "Gemini 側で一時的な問題が起きているようです。時間をおいて、もう一度お試しください。";
const NETWORK_MESSAGE = "通信に失敗しました。接続を確かめて、もう一度お試しください。";

/** API の失敗の状態コード（null＝通信の失敗・応答なし）から案内を返す。上のどれでもない場合は本番と同じ文 */
export function analysisErrorMessage(status: number | null): string {
  if (status === null) return NETWORK_MESSAGE;
  if (status === 400 || status === 401 || status === 403) return KEY_MESSAGE;
  if (status === 429) return LIMIT_MESSAGE;
  if (status >= 500 && status <= 599) return SERVER_MESSAGE;
  return FAILURE_MESSAGE;
}

/** generateAnalysis の失敗の返り値から案内を選ぶ。reason が call のときだけ状態コードを見る */
export function failureMessageOf(failure: { reason: "invalid" | "call" | "config"; callStatus: number | null }): string {
  if (failure.reason === "call") return analysisErrorMessage(failure.callStatus);
  return FAILURE_MESSAGE;
}
