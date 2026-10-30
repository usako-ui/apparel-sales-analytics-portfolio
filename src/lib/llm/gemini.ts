// Gemini 固有の処理（T-29）。この中だけで @google/genai を使う
import "server-only";
import { GoogleGenAI } from "@google/genai";
import { LlmCallError, statusOf } from "./errors";
import type { LlmConfig } from "./config";
import type { LlmRequest, LlmResponse } from "./types";

export async function callGemini(config: LlmConfig, request: LlmRequest): Promise<LlmResponse> {
  try {
    // SDK の自動再試行は止める（attempts 1＝再試行なし）。応答なしは30秒で打ち切る
    const ai = new GoogleGenAI({
      apiKey: config.apiKey,
      httpOptions: { timeout: 30_000, retryOptions: { attempts: 1 } },
    });
    const result = await ai.models.generateContent({
      model: config.model,
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
      model: config.model,
    };
  } catch (error) {
    // 元のエラーはキーや URL を含むことがあるため、状態コードだけ残して作り直す
    if (error instanceof LlmCallError) throw error;
    throw new LlmCallError(statusOf(error));
  }
}
