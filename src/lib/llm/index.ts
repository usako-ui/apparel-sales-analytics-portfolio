// LLM ラッパーの入口（T-29）。呼び出し側（T-31 以降）は generateJson だけを使う
// 絶対に隠すキー：ANTHROPIC_API_KEY・GEMINI_API_KEY（サーバー側だけ。NEXT_PUBLIC_ に入れない）
// "server-only" により、Client Component から import するとビルドエラーになる
import "server-only";
import { callClaude } from "./claude";
import { resolveLlmConfig } from "./config";
import { callGemini } from "./gemini";
import type { GenerateJson } from "./types";

export { LlmCallError, LlmConfigError } from "./errors";
export type { GenerateJson, LlmRequest, LlmResponse, LlmUsage } from "./types";

/** LLM_PROVIDER で選んだプロバイダに送る。失敗しても別のプロバイダへは切り替えない */
export const generateJson: GenerateJson = async (request) => {
  const config = resolveLlmConfig();
  return config.provider === "claude" ? callClaude(config, request) : callGemini(config, request);
};
