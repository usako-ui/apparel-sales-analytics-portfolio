// ブラウザから Gemini を呼ぶ（CR-02 手順4）。src/lib/llm/gemini.ts と同じ設定。
// キーは SDK が HTTP ヘッダ（x-goog-api-key）で送る。失敗時は元のエラーを捨て、状態コードだけ残す
import { LlmCallError, statusOf } from "@/lib/llm/errors";
import type { GenerateJson } from "@/lib/llm/types";

/** デモは環境変数を持たないため定数（本番の既定と同じ・無料枠） */
export const DEMO_GEMINI_MODEL = "gemini-3.5-flash-lite";

/** テストで偽の SDK に差し替えるための最小の形 */
export type GeminiSdk = {
  GoogleGenAI: new (options: {
    apiKey: string;
    httpOptions: { timeout: number; retryOptions: { attempts: number } };
  }) => {
    models: {
      generateContent(params: {
        model: string;
        contents: string;
        config: { systemInstruction: string; responseMimeType: string; maxOutputTokens: number };
      }): Promise<{
        text?: string;
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
      }>;
    };
  };
};

/** 初回の「分析を生成」を押した時に読み込む（最初の表示を重くしない） */
const loadRealSdk = (): Promise<GeminiSdk> => import("@google/genai") as unknown as Promise<GeminiSdk>;

export function createBrowserGenerate(apiKey: string, loadSdk: () => Promise<GeminiSdk> = loadRealSdk): GenerateJson {
  return async (request) => {
    try {
      const { GoogleGenAI } = await loadSdk();
      // SDK の自動再試行は止める（attempts 1＝再試行なし）。応答なしは30秒で打ち切る
      const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: 30_000, retryOptions: { attempts: 1 } } });
      const result = await ai.models.generateContent({
        model: DEMO_GEMINI_MODEL,
        contents: request.user,
        config: { systemInstruction: request.system, responseMimeType: "application/json", maxOutputTokens: 4096 },
      });
      const text = result.text;
      if (typeof text !== "string" || text === "") throw new LlmCallError(null);
      return {
        text,
        usage: {
          inputTokens: result.usageMetadata?.promptTokenCount ?? 0,
          outputTokens: result.usageMetadata?.candidatesTokenCount ?? 0,
        },
        provider: "gemini",
        model: DEMO_GEMINI_MODEL,
      };
    } catch (error) {
      // 元のエラーはキーや URL を含むことがある。状態コードだけ残して作り直す（console にも出さない）
      if (error instanceof LlmCallError) throw error;
      throw new LlmCallError(statusOf(error));
    }
  };
}
