// AI分析の生成（T-31）：送信 → JSON を読む → 型の検証 → 再試行（最大2回＝合計3回）→ 数字の照合
// LLM の呼び出し(generate)は引数で受け取る（テストではモック。実際は lib/llm の generateJson）
// 失敗の理由コードは開発者のログ用。利用者に見せる文は message（技術的な内容・キーを含めない）

import { LlmCallError } from "@/lib/llm/errors";
import type { GenerateJson, LlmUsage } from "@/lib/llm/types";
import { buildAnalysisPayload, buildAnalysisRequest, type AnalysisInput } from "./prompt";
import { analysisResultSchema, type NumberWarning, type StoredReport } from "./schema";
import { verifyNumbers } from "./verify";

/** 最初の1回＋再試行2回 */
export const MAX_ATTEMPTS = 3;

export const FAILURE_MESSAGE = "AI分析を生成できませんでした。時間をおいて、もう一度生成してください。";

export type GenerateAnalysisResult =
  | {
      ok: true;
      report: StoredReport;
      hasNumberWarning: boolean;
      /** 再試行した分も含めた合計のトークン数（requirements 第14項） */
      usage: LlmUsage;
      provider: "claude" | "gemini";
      model: string;
      attempts: number;
    }
  | {
      ok: false;
      message: string;
      /** invalid＝3回とも型に合わない／call＝API の失敗／config＝設定の誤り（ログ用） */
      reason: "invalid" | "call" | "config";
      /** 試行した回数と、そこまでに使った合計トークン数（失敗でも回数を使うため記録できる） */
      attempts: number;
      usage: LlmUsage;
      /** reason が call のときの API の状態コード（通信の失敗など不明なら null）。キー・URL を含まない数字だけ */
      callStatus: number | null;
    };

/** JSON として読む（読めなければ null） */
function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function generateAnalysis(
  input: AnalysisInput,
  generate: GenerateJson,
): Promise<GenerateAnalysisResult> {
  // 対象月のデータがない等の入力の誤りは、呼び出し側のバグなのでそのまま投げる
  const request = buildAnalysisRequest(input);
  const payload = buildAnalysisPayload(input);
  const usage: LlmUsage = { inputTokens: 0, outputTokens: 0 };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let response;
    try {
      response = await generate(request);
    } catch (error) {
      // API の失敗は、すぐ再試行しない（無料枠の回数を使い切らないため）。設定の誤りかどうかだけ区別する
      const isConfig = error instanceof Error && error.name === "LlmConfigError";
      const callStatus = error instanceof LlmCallError ? error.status : null;
      return {
        ok: false,
        message: FAILURE_MESSAGE,
        reason: isConfig ? "config" : "call",
        attempts: attempt,
        usage,
        callStatus,
      };
    }
    usage.inputTokens += response.usage.inputTokens;
    usage.outputTokens += response.usage.outputTokens;

    const parsed = analysisResultSchema.safeParse(parseJson(response.text));
    if (!parsed.success) continue; // JSON でない・型に合わない → 再試行

    const numberWarnings: NumberWarning[] = verifyNumbers(parsed.data, payload);
    return {
      ok: true,
      report: { ...parsed.data, numberWarnings },
      hasNumberWarning: numberWarnings.length > 0,
      usage,
      provider: response.provider,
      model: response.model,
      attempts: attempt,
    };
  }
  return { ok: false, message: FAILURE_MESSAGE, reason: "invalid", attempts: MAX_ATTEMPTS, usage, callStatus: null };
}
