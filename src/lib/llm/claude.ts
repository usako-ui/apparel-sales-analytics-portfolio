// Claude 固有の処理（T-29）。この中だけで @anthropic-ai/sdk を使う
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { LlmCallError, statusOf } from "./errors";
import type { LlmConfig } from "./config";
import type { LlmRequest, LlmResponse } from "./types";

const MAX_OUTPUT_TOKENS = 4096;
/** 応答なしのまま関数の時間切れまで待たない（ミリ秒） */
export const REQUEST_TIMEOUT_MS = 30_000;

/** Claude は JSON モードがないため、最初の { から最後の } までを取り出す（前後の説明文・コードブロックを除く） */
export function extractJson(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return start >= 0 && end > start ? text.slice(start, end + 1) : text;
}

export async function callClaude(config: LlmConfig, request: LlmRequest): Promise<LlmResponse> {
  try {
    const client = new Anthropic({ apiKey: config.apiKey, maxRetries: 0, timeout: REQUEST_TIMEOUT_MS });
    const message = await client.messages.create({
      model: config.model,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: request.system,
      messages: [{ role: "user", content: request.user }],
    });
    const raw = message.content.map((block) => (block.type === "text" ? block.text : "")).join("");
    if (raw === "") throw new LlmCallError(null);
    return {
      text: extractJson(raw),
      usage: { inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens },
      provider: "claude",
      model: config.model,
    };
  } catch (error) {
    if (error instanceof LlmCallError) throw error;
    throw new LlmCallError(statusOf(error));
  }
}
