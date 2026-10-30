// LLM の設定の読み取り（T-29）。環境変数 → { provider, model, apiKey } を決める純粋な関数
// 自動フォールバックはしない：値がないか不正なら、日本語のエラーで止める
// エラー文には「変数の名前」だけを入れ、値（キーなど）は入れない

import { LlmConfigError } from "./errors";

export const LLM_PROVIDERS = ["claude", "gemini"] as const;
export type LlmProvider = (typeof LLM_PROVIDERS)[number];

/** Claude のモデル（講座コード）。変える時はここだけ */
export const CLAUDE_MODEL = "claude-sonnet-4-6";

/** Gemini の使えるモデル（architecture.md 第8項）。先頭が既定値 */
export const GEMINI_MODELS = ["gemini-3.5-flash-lite", "gemini-3.8-flash"] as const;
export const GEMINI_DEFAULT_MODEL = GEMINI_MODELS[0];

export type LlmConfig = {
  provider: LlmProvider;
  model: string;
  /** サーバー側だけで使う。ログ・エラー文・戻り値の表示に出さない */
  apiKey: string;
};

type Env = Readonly<Record<string, string | undefined>>;

function isProvider(value: string): value is LlmProvider {
  return (LLM_PROVIDERS as readonly string[]).includes(value);
}

/** 前後の空白を除いた値。空なら undefined */
function read(env: Env, name: string): string | undefined {
  const value = env[name]?.trim();
  return value ? value : undefined;
}

function requireKey(env: Env, name: string): string {
  const value = read(env, name);
  if (!value) {
    throw new LlmConfigError(`環境変数がありません：${name}（.env.local を確認してください）`);
  }
  return value;
}

/** Gemini のモデル名。GEMINI_MODEL がなければ既定値。使える値以外はエラー（既定値に戻さない） */
function resolveGeminiModel(env: Env): string {
  const model = read(env, "GEMINI_MODEL");
  if (model === undefined) return GEMINI_DEFAULT_MODEL;
  if (!(GEMINI_MODELS as readonly string[]).includes(model)) {
    // 不正な値は設定の誤りであって秘密ではないが、念のため長い値は切る
    const shown = model.length > 40 ? `${model.slice(0, 40)}…` : model;
    throw new LlmConfigError(
      `GEMINI_MODEL の値が使えません：「${shown}」。使える値は ${GEMINI_MODELS.join("・")} のどちらかです。`,
    );
  }
  return model;
}

/** 環境変数から設定を決める。env を渡せるのはテストのため（実行時は process.env） */
export function resolveLlmConfig(env: Env = process.env): LlmConfig {
  const rawProvider = read(env, "LLM_PROVIDER");
  if (rawProvider === undefined) {
    throw new LlmConfigError(
      `環境変数がありません：LLM_PROVIDER（${LLM_PROVIDERS.join(" か ")} のどちらかを .env.local に書いてください）`,
    );
  }
  if (!isProvider(rawProvider)) {
    throw new LlmConfigError(`LLM_PROVIDER の値が使えません。${LLM_PROVIDERS.join(" か ")} のどちらかにしてください。`);
  }

  if (rawProvider === "claude") {
    return { provider: "claude", model: CLAUDE_MODEL, apiKey: requireKey(env, "ANTHROPIC_API_KEY") };
  }
  return { provider: "gemini", model: resolveGeminiModel(env), apiKey: requireKey(env, "GEMINI_API_KEY") };
}
