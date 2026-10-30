// CR-02 手順4：ブラウザ版 Gemini（失敗の文言・キーがエラーに入らない・キー保持）。実 API は呼ばない
import { describe, expect, it, vi } from "vitest";
import { FAILURE_MESSAGE } from "@/lib/analysis/run";
import { LlmCallError } from "@/lib/llm/errors";
import { analysisErrorMessage, failureMessageOf } from "../../demo/lib/analysis-errors";
import { createBrowserGenerate, DEMO_GEMINI_MODEL, type GeminiSdk } from "../../demo/lib/gemini-browser";
import { createKeyHolder } from "../../demo/lib/key-holder";

const LEAK_PROBE = "LEAK_PROBE-KEY-dummy-0123456789";
const request = { system: "指示", user: "データ" };

describe("analysisErrorMessage（状態コード → 日本語）", () => {
  const KEY = "キーが正しくないようです。Google AI Studio で作ったキーを、もう一度入力してください。";
  it("400・401・403 はキーの案内", () => {
    for (const s of [400, 401, 403]) expect(analysisErrorMessage(s)).toBe(KEY);
  });
  it("429 は回数の上限", () => {
    expect(analysisErrorMessage(429)).toBe("Gemini の利用回数の上限に達しました。しばらく待ってから、もう一度お試しください。");
  });
  it("500〜599 は Google 側の一時的な問題", () => {
    const text = "Gemini 側で一時的な問題が起きているようです。時間をおいて、もう一度お試しください。";
    for (const s of [500, 503, 599]) expect(analysisErrorMessage(s)).toBe(text);
  });
  it("null は通信の失敗", () => {
    expect(analysisErrorMessage(null)).toBe("通信に失敗しました。接続を確かめて、もう一度お試しください。");
  });
  it("表にない状態コード（404 など）・範囲の境目は本番と同じ文", () => {
    for (const s of [404, 499, 600]) expect(analysisErrorMessage(s)).toBe(FAILURE_MESSAGE);
  });
  it("failureMessageOf：型に合わない（invalid）・設定（config）は本番と同じ文。call だけ状態コードで出し分ける", () => {
    expect(failureMessageOf({ reason: "invalid", callStatus: null })).toBe(FAILURE_MESSAGE);
    expect(failureMessageOf({ reason: "config", callStatus: 429 })).toBe(FAILURE_MESSAGE);
    expect(failureMessageOf({ reason: "call", callStatus: 429 })).toBe(analysisErrorMessage(429));
    expect(failureMessageOf({ reason: "call", callStatus: null })).toBe(analysisErrorMessage(null));
  });
});

describe("createBrowserGenerate（キーがエラーに入らない）", () => {
  function sdkThatThrows(error: unknown): GeminiSdk {
    return {
      GoogleGenAI: class {
        models = { generateContent: () => Promise.reject(error) };
      },
    } as unknown as GeminiSdk;
  }
  const leaky = (status?: number) =>
    Object.assign(new Error(`request to https://generativelanguage.googleapis.com/v1beta/x?key=${LEAK_PROBE} failed`), {
      status,
      stack: `Error: ${LEAK_PROBE}`,
      cause: new Error(LEAK_PROBE),
    });

  async function caught(sdk: GeminiSdk): Promise<unknown> {
    try {
      await createBrowserGenerate(LEAK_PROBE, async () => sdk)(request);
    } catch (e) {
      return e;
    }
    throw new Error("失敗するはず");
  }

  it("SDK が失敗 → LlmCallError(状態コードだけ)。キー・URL・元の文を含まない", async () => {
    const error = await caught(sdkThatThrows(leaky(429)));
    expect(error).toBeInstanceOf(LlmCallError);
    expect((error as LlmCallError).status).toBe(429);
    const dump = JSON.stringify(error, Object.getOwnPropertyNames(error)) + String((error as Error).stack);
    expect(dump).not.toContain(LEAK_PROBE);
    expect(dump).not.toContain("googleapis");
    expect((error as Error).cause).toBeUndefined();
  });

  it("状態コードがない失敗（通信の失敗）は status null", async () => {
    const error = (await caught(sdkThatThrows(leaky()))) as LlmCallError;
    expect(error.status).toBeNull();
  });

  it("SDK の読み込み自体が失敗しても、キーを含まない LlmCallError", async () => {
    const error = await (async () => {
      try {
        await createBrowserGenerate(LEAK_PROBE, () => Promise.reject(leaky()))(request);
      } catch (e) {
        return e;
      }
    })();
    expect(error).toBeInstanceOf(LlmCallError);
    expect(String((error as Error).message)).not.toContain(LEAK_PROBE);
  });

  it("空の応答は status null の LlmCallError", async () => {
    const sdk = {
      GoogleGenAI: class {
        models = { generateContent: () => Promise.resolve({ text: "" }) };
      },
    } as unknown as GeminiSdk;
    const error = (await caught(sdk)) as LlmCallError;
    expect(error).toBeInstanceOf(LlmCallError);
    expect(error.status).toBeNull();
  });

  it("成功：gemini.ts と同じ設定で呼ぶ（再試行なし・30秒・JSON・上限4096）。トークン数を返す。キーは SDK の引数にだけ渡す", async () => {
    const constructed = vi.fn();
    const generateContent = vi.fn().mockResolvedValue({
      text: '{"a":1}',
      usageMetadata: { promptTokenCount: 11, candidatesTokenCount: 7 },
    });
    const sdk = {
      GoogleGenAI: class {
        models = { generateContent };
        constructor(options: unknown) {
          constructed(options);
        }
      },
    } as unknown as GeminiSdk;
    const response = await createBrowserGenerate(LEAK_PROBE, async () => sdk)(request);
    expect(constructed).toHaveBeenCalledWith({
      apiKey: LEAK_PROBE,
      httpOptions: { timeout: 30_000, retryOptions: { attempts: 1 } },
    });
    expect(generateContent).toHaveBeenCalledWith({
      model: DEMO_GEMINI_MODEL,
      contents: "データ",
      config: { systemInstruction: "指示", responseMimeType: "application/json", maxOutputTokens: 4096 },
    });
    expect(response).toEqual({
      text: '{"a":1}',
      usage: { inputTokens: 11, outputTokens: 7 },
      provider: "gemini",
      model: "gemini-3.5-flash-lite",
    });
    expect(JSON.stringify(response)).not.toContain(LEAK_PROBE);
  });

  it("実行中に console へキーを出さない", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) => vi.spyOn(console, m));
    await caught(sdkThatThrows(leaky(401)));
    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    }
  });
});

describe("createKeyHolder（メモリだけ）", () => {
  it("storage・Cookie に触れない（偽物が呼ばれたら失敗）", () => {
    const fake = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn(), key: vi.fn(), length: 0 };
    const cookieSet = vi.fn();
    vi.stubGlobal("localStorage", fake);
    vi.stubGlobal("sessionStorage", fake);
    vi.stubGlobal("document", {
      get cookie() {
        cookieSet("get");
        return "";
      },
      set cookie(v: string) {
        cookieSet(v);
      },
    });
    try {
      const holder = createKeyHolder();
      holder.set(`  ${LEAK_PROBE}  `);
      expect(holder.get()).toBe(LEAK_PROBE);
      expect(holder.has()).toBe(true);
      holder.clear();
      expect(holder.get()).toBeNull();
      expect(holder.has()).toBe(false);
      for (const fn of Object.values(fake)) if (typeof fn === "function") expect(fn).not.toHaveBeenCalled();
      expect(cookieSet).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("空白だけの入力は「キーなし」。保持者どうしは独立", () => {
    const a = createKeyHolder();
    const b = createKeyHolder();
    a.set("   ");
    expect(a.has()).toBe(false);
    b.set(LEAK_PROBE);
    expect(a.get()).toBeNull();
  });
});
