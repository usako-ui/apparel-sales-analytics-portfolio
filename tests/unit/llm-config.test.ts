// T-29：LLM の設定・ラッパー（すべてモック。実 API は呼ばない）
import { beforeEach, describe, expect, it, vi } from "vitest";

// server-only は Client から import した時にビルドを止める仕組み。テストでは無効にする
vi.mock("server-only", () => ({}));

const geminiGenerate = vi.fn();
const geminiConstructor = vi.fn();
const claudeCreate = vi.fn();
const claudeConstructor = vi.fn();

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent: geminiGenerate };
    constructor(options: unknown) {
      geminiConstructor(options);
    }
  },
}));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: claudeCreate };
    constructor(options: unknown) {
      claudeConstructor(options);
    }
  },
}));

import { resolveLlmConfig } from "@/lib/llm/config";
import { generateJson, LlmCallError, LlmConfigError } from "@/lib/llm";
import { extractJson } from "@/lib/llm/claude";

// 偽の値（実際のキーではない）
const FAKE_GEMINI = "dummy-gemini-value-0001";
const FAKE_CLAUDE = "dummy-claude-value-0002";
const request = { system: "指示", user: "データ" };
const jsonText = '{"summary":"テスト"}';

function useEnv(env: Record<string, string>) {
  // .env.local の値がテストに入っているため、まず関係する変数を空にしてから設定する
  for (const name of ["LLM_PROVIDER", "GEMINI_MODEL", "GEMINI_API_KEY", "ANTHROPIC_API_KEY"]) {
    vi.stubEnv(name, "");
  }
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
}

beforeEach(() => {
  vi.unstubAllEnvs();
  geminiGenerate.mockReset();
  geminiConstructor.mockReset();
  claudeCreate.mockReset();
  claudeConstructor.mockReset();
});

describe("resolveLlmConfig（設定の決め方）", () => {
  it("gemini：GEMINI_MODEL がなければ既定値 gemini-3.5-flash-lite", () => {
    const config = resolveLlmConfig({ LLM_PROVIDER: "gemini", GEMINI_API_KEY: FAKE_GEMINI });
    expect(config).toMatchObject({ provider: "gemini", model: "gemini-3.5-flash-lite" });
  });

  it("gemini：GEMINI_MODEL が空文字でも既定値", () => {
    const config = resolveLlmConfig({ LLM_PROVIDER: "gemini", GEMINI_API_KEY: FAKE_GEMINI, GEMINI_MODEL: "" });
    expect(config.model).toBe("gemini-3.5-flash-lite");
  });

  it("gemini：GEMINI_MODEL=gemini-3.8-flash で上書きできる", () => {
    const config = resolveLlmConfig({
      LLM_PROVIDER: "gemini",
      GEMINI_API_KEY: FAKE_GEMINI,
      GEMINI_MODEL: "gemini-3.8-flash",
    });
    expect(config.model).toBe("gemini-3.8-flash");
  });

  it("gemini：不正なモデル名は日本語のエラー（既定値に戻さない）", () => {
    expect(() =>
      resolveLlmConfig({ LLM_PROVIDER: "gemini", GEMINI_API_KEY: FAKE_GEMINI, GEMINI_MODEL: "gemini-3-flash-preview" }),
    ).toThrow(/GEMINI_MODEL の値が使えません/);
  });

  it("claude：モデルは claude-sonnet-4-6（GEMINI_MODEL の影響を受けない）", () => {
    const config = resolveLlmConfig({
      LLM_PROVIDER: "claude",
      ANTHROPIC_API_KEY: FAKE_CLAUDE,
      GEMINI_MODEL: "gemini-3.8-flash",
    });
    expect(config).toMatchObject({ provider: "claude", model: "claude-sonnet-4-6" });
  });

  it("LLM_PROVIDER が未設定・空なら日本語のエラー", () => {
    expect(() => resolveLlmConfig({})).toThrow(/環境変数がありません：LLM_PROVIDER/);
    expect(() => resolveLlmConfig({ LLM_PROVIDER: "  " })).toThrow(LlmConfigError);
  });

  it("LLM_PROVIDER が不正な値なら日本語のエラー（フォールバックしない）", () => {
    expect(() => resolveLlmConfig({ LLM_PROVIDER: "openai", GEMINI_API_KEY: FAKE_GEMINI })).toThrow(
      /LLM_PROVIDER の値が使えません/,
    );
  });

  it("選んだプロバイダのキーがなければ、変数の名前だけを出してエラー", () => {
    expect(() => resolveLlmConfig({ LLM_PROVIDER: "claude", GEMINI_API_KEY: FAKE_GEMINI })).toThrow(
      /環境変数がありません：ANTHROPIC_API_KEY/,
    );
    expect(() => resolveLlmConfig({ LLM_PROVIDER: "gemini", ANTHROPIC_API_KEY: FAKE_CLAUDE })).toThrow(
      /環境変数がありません：GEMINI_API_KEY/,
    );
  });
});

describe("generateJson（どちらのプロバイダでも同じ形）", () => {
  it("gemini：text・usage・provider・model を返す。設定した API キーで呼ぶ", async () => {
    useEnv({ LLM_PROVIDER: "gemini", GEMINI_API_KEY: FAKE_GEMINI });
    geminiGenerate.mockResolvedValue({
      text: jsonText,
      usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 45 },
    });

    const result = await generateJson(request);

    expect(result).toEqual({
      text: jsonText,
      usage: { inputTokens: 120, outputTokens: 45 },
      provider: "gemini",
      model: "gemini-3.5-flash-lite",
    });
    expect(geminiConstructor).toHaveBeenCalledWith({
      apiKey: FAKE_GEMINI,
      httpOptions: { timeout: 30_000, retryOptions: { attempts: 1 } }, // 自動再試行なし・30秒で打ち切り
    });
    expect(geminiGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gemini-3.5-flash-lite",
        contents: "データ",
        config: expect.objectContaining({ systemInstruction: "指示", responseMimeType: "application/json" }),
      }),
    );
    expect(claudeCreate).not.toHaveBeenCalled();
  });

  it("gemini：GEMINI_MODEL の上書きが API 呼び出しに反映される", async () => {
    useEnv({ LLM_PROVIDER: "gemini", GEMINI_API_KEY: FAKE_GEMINI, GEMINI_MODEL: "gemini-3.8-flash" });
    geminiGenerate.mockResolvedValue({ text: jsonText, usageMetadata: {} });
    const result = await generateJson(request);
    expect(result.model).toBe("gemini-3.8-flash");
    expect(result.usage).toEqual({ inputTokens: 0, outputTokens: 0 });
  });

  it("claude：同じ形で返す（前後の説明文・コードブロックは取り除く）", async () => {
    useEnv({ LLM_PROVIDER: "claude", ANTHROPIC_API_KEY: FAKE_CLAUDE });
    claudeCreate.mockResolvedValue({
      content: [{ type: "text", text: `結果です\n\`\`\`json\n${jsonText}\n\`\`\`` }],
      usage: { input_tokens: 200, output_tokens: 80 },
    });

    const result = await generateJson(request);

    expect(result).toEqual({
      text: jsonText,
      usage: { inputTokens: 200, outputTokens: 80 },
      provider: "claude",
      model: "claude-sonnet-4-6",
    });
    expect(claudeConstructor).toHaveBeenCalledWith({ apiKey: FAKE_CLAUDE, maxRetries: 0, timeout: 30_000 });
    expect(claudeCreate).toHaveBeenCalledWith(expect.objectContaining({ max_tokens: 4096 }));
    expect(claudeCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: "claude-sonnet-4-6", system: "指示", messages: [{ role: "user", content: "データ" }] }),
    );
    expect(geminiGenerate).not.toHaveBeenCalled();
  });

  it("LLM_PROVIDER が未設定なら、どちらの API も呼ばずに日本語のエラー", async () => {
    useEnv({ GEMINI_API_KEY: FAKE_GEMINI, ANTHROPIC_API_KEY: FAKE_CLAUDE });
    await expect(generateJson(request)).rejects.toThrow(/LLM_PROVIDER/);
    expect(geminiGenerate).not.toHaveBeenCalled();
    expect(claudeCreate).not.toHaveBeenCalled();
  });

  it("失敗しても別のプロバイダへ切り替えない（自動フォールバックなし）", async () => {
    useEnv({ LLM_PROVIDER: "gemini", GEMINI_API_KEY: FAKE_GEMINI, ANTHROPIC_API_KEY: FAKE_CLAUDE });
    geminiGenerate.mockRejectedValue(Object.assign(new Error("boom"), { status: 429 }));
    await expect(generateJson(request)).rejects.toBeInstanceOf(LlmCallError);
    expect(claudeCreate).not.toHaveBeenCalled();
  });
});

describe("エラーにキーの値が含まれない", () => {
  it("gemini：SDK のエラー文にキーが入っていても、投げ直したエラーには出ない", async () => {
    useEnv({ LLM_PROVIDER: "gemini", GEMINI_API_KEY: FAKE_GEMINI });
    geminiGenerate.mockRejectedValue(
      Object.assign(new Error(`request to https://example.test/?q=${FAKE_GEMINI} failed`), { status: 403 }),
    );
    const error = await generateJson(request).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LlmCallError);
    const e = error as LlmCallError;
    expect(e.status).toBe(403);
    expect(e.message).not.toContain(FAKE_GEMINI);
    expect(String(e.stack)).not.toContain(FAKE_GEMINI);
    expect(e.cause).toBeUndefined();
  });

  it("claude：同様にキーが出ない", async () => {
    useEnv({ LLM_PROVIDER: "claude", ANTHROPIC_API_KEY: FAKE_CLAUDE });
    claudeCreate.mockRejectedValue(new Error(`invalid header: ${FAKE_CLAUDE}`));
    const error = (await generateJson(request).catch((e: unknown) => e)) as LlmCallError;
    expect(error).toBeInstanceOf(LlmCallError);
    expect(error.status).toBeNull();
    expect(error.message).not.toContain(FAKE_CLAUDE);
    expect(String(error.stack)).not.toContain(FAKE_CLAUDE);
  });

  it("設定エラーの文にもキーの値は出ない", () => {
    const error = (() => {
      try {
        resolveLlmConfig({ LLM_PROVIDER: "gemini", GEMINI_API_KEY: FAKE_GEMINI, GEMINI_MODEL: "x" });
      } catch (e) {
        return e as Error;
      }
      throw new Error("エラーになるはず");
    })();
    expect(error.message).not.toContain(FAKE_GEMINI);
  });

  it("応答が空のときも、日本語の失敗として扱う", async () => {
    useEnv({ LLM_PROVIDER: "gemini", GEMINI_API_KEY: FAKE_GEMINI });
    geminiGenerate.mockResolvedValue({ text: "", usageMetadata: {} });
    await expect(generateJson(request)).rejects.toThrow(/AI分析の呼び出しに失敗しました/);
  });
});

describe("extractJson", () => {
  it("波かっこがなければそのまま返す", () => {
    expect(extractJson("JSONではない")).toBe("JSONではない");
  });
});
