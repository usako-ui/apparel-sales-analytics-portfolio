// T-31・T-32：AI分析の生成・検証・再試行・保存・数字の照合（モック。実 API は呼ばない）
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { buildAnalysisInput, defaultBreakdownPeriod, formatMonthJa } from "@/lib/analysis/input";
import { ANALYSIS_SYSTEM_PROMPT, buildAnalysisPayload } from "@/lib/analysis/prompt";
import { FAILURE_MESSAGE, MAX_ATTEMPTS, generateAnalysis } from "@/lib/analysis/run";
import { saveReport } from "@/lib/analysis/save";
import { analysisResultSchema } from "@/lib/analysis/schema";
import { extractNumbers, verifyNumbers } from "@/lib/analysis/verify";
import type { SalesRow } from "@/lib/csv/validate";
import { LlmCallError } from "@/lib/llm/errors";
import type { GenerateJson, LlmResponse } from "@/lib/llm/types";

function fixture(name: string): string {
  return readFileSync(path.resolve(__dirname, "../fixtures/llm", name), "utf8");
}

function row(over: Partial<SalesRow>): SalesRow {
  return {
    orderDate: "2025-10-05",
    customerId: "CUST-A-001",
    productName: "ウールコート",
    category: "アウター",
    sku: "OUT-001",
    quantity: 1,
    revenue: 10000,
    cost: 4000,
    ...over,
  };
}

// 10月：売上10,000・粗利6,000／11月：売上20,000・粗利12,000・購入者2人のうち1人がリピート(50.0%)
const rows: SalesRow[] = [
  row({ orderDate: "2025-10-05" }),
  row({ orderDate: "2025-11-07", revenue: 15000, cost: 6000 }),
  row({ orderDate: "2025-11-08", customerId: "CUST-A-002", sku: "TOP-001", category: "トップス", revenue: 5000, cost: 2000 }),
];
const input = buildAnalysisInput(rows, "2025-11");
const payload = buildAnalysisPayload(input);

function reply(text: string): LlmResponse {
  return { text, usage: { inputTokens: 100, outputTokens: 50 }, provider: "gemini", model: "gemini-3.5-flash-lite" };
}

describe("出力の型（Zod）", () => {
  const valid = JSON.parse(fixture("valid.json")) as Record<string, unknown>;

  it("正しい見本は通る", () => {
    expect(analysisResultSchema.safeParse(valid).success).toBe(true);
  });
  it("highlights が3件でない・concerns が2件でない・actions が空・priority 不正・summary 201字は通らない", () => {
    const bad = (over: Record<string, unknown>) => analysisResultSchema.safeParse({ ...valid, ...over }).success;
    expect(bad({ highlights: ["a", "b"] })).toBe(false);
    expect(bad({ highlights: ["a", "b", "c", "d"] })).toBe(false);
    expect(bad({ concerns: ["a"] })).toBe(false);
    expect(bad({ actions: [] })).toBe(false);
    expect(bad({ actions: [{ priority: "urgent", action: "x" }] })).toBe(false);
    expect(bad({ summary: "あ".repeat(201) })).toBe(false);
    expect(bad({ summary: "あ".repeat(200) })).toBe(true);
  });
  it("T-37：保存済みの actions 1件だけの結果も、まだ読める（schema は1件以上のまま）", () => {
    const one = analysisResultSchema.safeParse({ ...valid, actions: [{ priority: "low", action: "様子を見る" }] });
    expect(one.success).toBe(true);
  });
  it("T-37：プロンプトは打ち手を2〜3件・少なくとも1件は high と指示している", () => {
    expect(ANALYSIS_SYSTEM_PROMPT).toContain("actions は2〜3件");
    expect(ANALYSIS_SYSTEM_PROMPT).toContain("少なくとも1件は high");
    expect(ANALYSIS_SYSTEM_PROMPT).not.toContain("1件以上");
  });
});

describe("generateAnalysis（再試行・失敗）", () => {
  it("正しい応答 → 1回で成功。警告なし・トークン数・プロバイダを持つ", async () => {
    const generate = vi.fn<GenerateJson>().mockResolvedValue(reply(fixture("valid.json")));
    const result = await generateAnalysis(input, generate);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.attempts).toBe(1);
    expect(result.hasNumberWarning).toBe(false);
    expect(result.report.numberWarnings).toEqual([]);
    expect(result.usage).toEqual({ inputTokens: 100, outputTokens: 50 });
    expect(result.provider).toBe("gemini");
  });

  it("型に合わない → 再試行 → 成功。トークン数は試行ぶんの合計", async () => {
    const generate = vi
      .fn<GenerateJson>()
      .mockResolvedValueOnce(reply(fixture("invalid-type.json")))
      .mockResolvedValueOnce(reply(fixture("not-json.txt")))
      .mockResolvedValueOnce(reply(fixture("valid.json")));
    const result = await generateAnalysis(input, generate);
    expect(generate).toHaveBeenCalledTimes(3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.attempts).toBe(3);
    expect(result.usage).toEqual({ inputTokens: 300, outputTokens: 150 });
  });

  it("3回とも失敗 → 日本語の失敗（技術的な内容を出さない）", async () => {
    const generate = vi.fn<GenerateJson>().mockResolvedValue(reply(fixture("not-json.txt")));
    const result = await generateAnalysis(input, generate);
    expect(generate).toHaveBeenCalledTimes(MAX_ATTEMPTS);
    expect(result).toEqual({
      ok: false,
      message: FAILURE_MESSAGE,
      reason: "invalid",
      attempts: 3,
      usage: { inputTokens: 300, outputTokens: 150 }, // 失敗でも使ったトークン数は残る
      callStatus: null,
    });
  });

  it("API の失敗は再試行せず、日本語の失敗にする（元のエラー文は出さない）", async () => {
    const generate = vi.fn<GenerateJson>().mockRejectedValue(new Error("upstream detail dummy-provider-value"));
    const result = await generateAnalysis(input, generate);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      ok: false,
      message: FAILURE_MESSAGE,
      reason: "call",
      attempts: 1,
      usage: { inputTokens: 0, outputTokens: 0 },
      callStatus: null,
    });
  });

  it("CR-02：LlmCallError の状態コードを callStatus で返す（文言・reason は本番のまま）", async () => {
    for (const status of [400, 401, 403, 429, 503, null]) {
      const generate = vi.fn<GenerateJson>().mockRejectedValue(new LlmCallError(status));
      const result = await generateAnalysis(input, generate);
      expect(generate).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({ ok: false, message: FAILURE_MESSAGE, reason: "call", callStatus: status });
    }
  });

  it("設定の誤りは reason=config（ログ用）で、利用者向けの文は同じ", async () => {
    const error = Object.assign(new Error("環境変数がありません：LLM_PROVIDER"), { name: "LlmConfigError" });
    const result = await generateAnalysis(input, vi.fn<GenerateJson>().mockRejectedValue(error));
    expect(result).toMatchObject({ ok: false, message: FAILURE_MESSAGE, reason: "config" });
  });

  it("LLM に送る内容は指示とデータが分かれている（system にデータなし）", async () => {
    const generate = vi.fn<GenerateJson>().mockResolvedValue(reply(fixture("valid.json")));
    await generateAnalysis(input, generate);
    const sent = generate.mock.calls[0][0];
    expect(sent.system).not.toContain("アウター");
    expect(sent.user).toContain("アウター");
  });
});

describe("カテゴリ別・SKU別の期間", () => {
  it("既定は対象月：10月の行は含めない", () => {
    expect(defaultBreakdownPeriod("2025-11")).toEqual({ kind: "month", month: "2025-11" });
    const nov = buildAnalysisInput(rows, "2025-11");
    expect(nov.categories.find((c) => c.category === "アウター")?.revenue).toBe(15000);
  });
  it("期間を渡せば全期間にもできる", () => {
    const all = buildAnalysisInput(rows, "2025-11", { kind: "all" });
    expect(all.categories.find((c) => c.category === "アウター")?.revenue).toBe(25000);
  });
});

describe("期間のラベル（AI の文と画面のずれ防止）", () => {
  it("対象月：「2025年11月の集計」がカテゴリ別・売れ筋の両方に入り、指示側にも期間を明記する旨がある", () => {
    const p = buildAnalysisPayload(buildAnalysisInput(rows, "2025-11"));
    expect(p.categories.periodLabel).toBe("2025年11月の集計");
    expect(p.topSkus.periodLabel).toBe("2025年11月の集計");
    expect(ANALYSIS_SYSTEM_PROMPT).toContain("期間を明記する");
  });
  it("全期間：「全期間（2025年10月〜2025年11月）の集計」", () => {
    const p = buildAnalysisPayload(buildAnalysisInput(rows, "2025-11", { kind: "all" }));
    expect(p.categories.periodLabel).toBe("全期間（2025年10月〜2025年11月）の集計");
  });
  it("月の文字列から作る（ゼロ詰めの月は「9月」）", () => {
    expect(formatMonthJa("2025-09")).toBe("2025年9月");
  });
});

describe("数字の照合：粗利がマイナスの月", () => {
  const negRows = [
    row({ orderDate: "2025-10-05", revenue: 10000, cost: 60000 }), // 粗利 -50,000
  ];
  const negPayload = buildAnalysisPayload(buildAnalysisInput(negRows, "2025-10"));
  const check = (summary: string) =>
    verifyNumbers(
      analysisResultSchema.parse({
        summary,
        highlights: ["注目1", "注目2", "注目3"],
        concerns: ["懸念1", "懸念2"],
        actions: [{ priority: "low", action: "様子を見る" }],
      }),
      negPayload,
    ).length;

  it("「-50,000円」「約5万円の赤字」と正しく書いても警告なし", () => {
    expect(check("粗利は-50,000円でした")).toBe(0);
    expect(check("粗利は約5万円の赤字でした")).toBe(0);
  });
  it("桁が違えば警告", () => {
    expect(check("粗利は-500,000円でした")).toBe(1);
    expect(check("粗利は約50万円の赤字でした")).toBe(1);
  });
  it("符号を省く・黒字と書く → 警告（赤字を黒字に見せない）", () => {
    expect(check("粗利 50,000円の黒字")).toBe(1);
    expect(check("粗利 50,000円")).toBe(1);
    expect(check("粗利は+50,000円")).toBe(1);
  });
  it("マイナス・▲・減 の書き方でも警告なし（全角のマイナス記号も）", () => {
    expect(check("粗利 マイナス50,000円")).toBe(0);
    expect(check("粗利 ▲50,000円")).toBe(0);
    expect(check("粗利 −５０，０００円")).toBe(0);
    expect(check("粗利は5万円減")).toBe(0);
  });
  it("プラスの値に「-」を付けると警告", () => {
    const pos = buildAnalysisPayload(buildAnalysisInput([row({ orderDate: "2025-10-05" })], "2025-10"));
    const warn = (summary: string) =>
      verifyNumbers(
        analysisResultSchema.parse({
          summary,
          highlights: ["注目1", "注目2", "注目3"],
          concerns: ["懸念1", "懸念2"],
          actions: [{ priority: "low", action: "様子を見る" }],
        }),
        pos,
      ).length;
    expect(warn("売上は10,000円でした")).toBe(0);
    expect(warn("売上は-10,000円でした")).toBe(1);
    expect(warn("売上は10,000円の赤字でした")).toBe(1);
  });
  it("「減」は割合の書き方（12.3%減）と混ざらない：金額の警告を増やさない", () => {
    expect(extractNumbers("前月比 12.3%減").map((f) => f.kind)).toEqual(["percent"]);
    expect(extractNumbers("売上が200,000円に減少").map((f) => f.sign)).toEqual([""]);
  });
  it("指示側にマイナスの金額の書き方がある", () => {
    expect(ANALYSIS_SYSTEM_PROMPT).toContain("マイナスであることを付けたまま書く");
  });
});

describe("数字の照合：割合の増減の向き", () => {
  const twoMonths = (sep: number, oct: number) =>
    buildAnalysisPayload(
      buildAnalysisInput(
        [
          row({ orderDate: "2025-09-05", revenue: sep, cost: 0 }),
          row({ orderDate: "2025-10-05", revenue: oct, cost: 0 }),
        ],
        "2025-10",
      ),
    );
  const warnCount = (p: ReturnType<typeof twoMonths>, summary: string) =>
    verifyNumbers(
      analysisResultSchema.parse({
        summary,
        highlights: ["注目1", "注目2", "注目3"],
        concerns: ["懸念1", "懸念2"],
        actions: [{ priority: "low", action: "様子を見る" }],
      }),
      p,
    ).length;
  const down = twoMonths(10000, 8770); // 売上 -12.3%
  const up = twoMonths(10000, 11230); // 売上 +12.3%
  const flat = twoMonths(10000, 10000); // 売上 0.0%

  it("向きが合えば警告なし（減る月に「減」・増える月に「増」）", () => {
    expect(warnCount(down, "売上は前月比12.3%減でした")).toBe(0);
    expect(warnCount(down, "売上は前月比12.3%減少でした")).toBe(0);
    expect(warnCount(up, "売上は前月比12.3%増でした")).toBe(0);
    expect(warnCount(up, "売上は前月比12.3%上昇でした")).toBe(0);
  });
  it("向きが逆なら警告", () => {
    expect(warnCount(down, "売上は前月比12.3%増でした")).toBe(1);
    expect(warnCount(down, "売上は前月比12.3%上昇でした")).toBe(1);
    expect(warnCount(up, "売上は前月比12.3%減でした")).toBe(1);
    expect(warnCount(up, "売上は前月比12.3%下落でした")).toBe(1);
  });
  it("割合の後ろに「の」が入っても向きを見る（「12.3%の増加」）", () => {
    expect(warnCount(down, "売上は前月比12.3%の増加でした")).toBe(1);
    expect(warnCount(down, "売上は前月比12.3%の減少でした")).toBe(0);
    expect(warnCount(up, "売上は前月比12.3%の減少でした")).toBe(1);
  });
  it("明示の符号があるときは今までの動作（向きのことばより符号が先）", () => {
    expect(warnCount(down, "売上は-12.3%でした")).toBe(0);
    expect(warnCount(down, "売上は+12.3%でした")).toBe(1);
    expect(warnCount(up, "売上は+12.3%でした")).toBe(0);
  });
  it("向きも符号もない水準の割合は絶対値で比べる（誤警告を増やさない）", () => {
    expect(warnCount(down, "売上の変化幅は12.3%でした")).toBe(0);
    expect(warnCount(up, "売上の変化幅は12.3%でした")).toBe(0);
    expect(warnCount(down, "売上の変化幅は20.0%でした")).toBe(1); // 大きさが違えば警告
  });
  it("許される値が 0 のときは向きを見ない（大きさだけ比べる）", () => {
    expect(warnCount(flat, "売上は前月比0.0%増でした")).toBe(0);
    expect(warnCount(flat, "売上は前月比0.0%減でした")).toBe(0);
    expect(warnCount(flat, "売上は前月比5.0%増でした")).toBe(1);
  });
  it("金額の「減」とは混ざらない：割合の「減」は割合だけ、金額の「減」は金額だけ", () => {
    expect(extractNumbers("12.3%減").map((f) => [f.kind, f.direction])).toEqual([["percent", "down"]]);
    expect(extractNumbers("5万円減").map((f) => [f.kind, f.sign])).toEqual([["amount", "-"]]);
    expect(extractNumbers("200,000円に減少").map((f) => f.sign)).toEqual([""]);
  });
  it("指示側に割合の増減の向きの書き方がある", () => {
    expect(ANALYSIS_SYSTEM_PROMPT).toContain("符号と同じ向きで書く");
  });
});

describe("数字の照合（T-32）", () => {
  it("正しい応答 → 警告なし", () => {
    const parsed = analysisResultSchema.parse(JSON.parse(fixture("valid.json")));
    expect(verifyNumbers(parsed, payload)).toEqual([]);
  });

  it("数字がずれた応答 → 警告あり（ずれた数値だけ）", async () => {
    const generate = vi.fn<GenerateJson>().mockResolvedValue(reply(fixture("wrong-number.json")));
    const result = await generateAnalysis(input, generate);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.hasNumberWarning).toBe(true); // コメントは保存・表示する側
    expect(result.report.numberWarnings.map((w) => w.text)).toEqual(["約30万円", "+85.0%", "73.5%"]);
    expect(result.report.numberWarnings[0]).toMatchObject({ kind: "amount", field: "summary" });
  });

  it("計算できない値（前月なしの10月）に AI が前月比を書いたら警告", () => {
    const oct = buildAnalysisPayload(buildAnalysisInput(rows, "2025-10"));
    const parsed = analysisResultSchema.parse({
      summary: "10月の売上は10,000円。前月比+15.0%で推移した。",
      highlights: ["注目1", "注目2", "注目3"],
      concerns: ["懸念1", "懸念2"],
      actions: [{ priority: "low", action: "様子を見る" }],
    });
    const warnings = verifyNumbers(parsed, oct);
    expect(warnings.map((w) => w.text)).toEqual(["+15.0%"]);
  });

  it("金額：「約」は±1%・桁の誤りは捕まえる・「約」なしは完全一致", () => {
    const check = (summary: string) =>
      verifyNumbers(
        analysisResultSchema.parse({ ...JSON.parse(fixture("valid.json")), summary }),
        payload,
      ).length;
    expect(check("売上は約20,100円")).toBe(0); // +0.5%
    expect(check("売上は約2.01万円")).toBe(0);
    expect(check("売上は約200,000円")).toBe(1); // 桁の誤り
    expect(check("売上は約2.1万円")).toBe(1); // +5%
    expect(check("売上は20,001円")).toBe(1); // 約なしは完全一致
    expect(check("売上は２０，０００円")).toBe(0); // 全角
  });

  it("割合：±0.1・符号・全角", () => {
    const check = (summary: string) =>
      verifyNumbers(
        analysisResultSchema.parse({ ...JSON.parse(fixture("valid.json")), summary }),
        payload,
      ).length;
    expect(check("リピート率は50.1%")).toBe(0);
    expect(check("リピート率は50.3%")).toBe(1);
    expect(check("リピート率は５０．０％")).toBe(0); // 全角
    expect(check("売上は-100.0%")).toBe(1); // 実際は+100.0%（符号が逆）
    expect(check("売上は100.0%増")).toBe(0);
  });

  it("取り出し：金額と割合を分けて読む", () => {
    const found = extractNumbers("約26.5万円、+12.3%、3.0pt、1,234円");
    expect(found.map((f) => [f.kind, f.value])).toEqual([
      ["amount", 265000],
      ["amount", 1234],
      ["percent", 12.3],
      ["percent", 3],
    ]);
  });
});

describe("saveReport（保存）", () => {
  // Supabase クライアントの代わり（連鎖呼び出しの形だけ再現）
  function fakeDb(opts: { uploads?: { id: string }[]; uploadError?: boolean; insertError?: boolean }) {
    const insert = vi.fn();
    const db = {
      from: (table: string) => {
        if (table === "uploads") {
          const chain = {
            select: () => chain,
            eq: () => chain,
            limit: () =>
              Promise.resolve({
                data: opts.uploads ?? [],
                error: opts.uploadError ? { message: "x" } : null,
              }),
          };
          return chain;
        }
        return {
          insert: (values: unknown) => {
            insert(values);
            return {
              select: () => ({
                single: () =>
                  Promise.resolve(
                    opts.insertError ? { data: null, error: { message: "x" } } : { data: { id: "report-1" }, error: null },
                  ),
              }),
            };
          },
        };
      },
    };
    return { db: db as never, insert };
  }

  const member = { shopId: "shop-1", userId: "user-1" };
  async function generated() {
    const r = await generateAnalysis(input, vi.fn<GenerateJson>().mockResolvedValue(reply(fixture("wrong-number.json"))));
    if (!r.ok) throw new Error("成功するはず");
    return r;
  }

  it("uploads に結んで reports に保存する（プロバイダ・トークン数・警告つき）", async () => {
    const { db, insert } = fakeDb({ uploads: [{ id: "upload-1" }] });
    const result = await saveReport(db, member, "2025-11", await generated());
    expect(result).toEqual({ ok: true, reportId: "report-1" });
    const values = insert.mock.calls[0][0] as Record<string, unknown>;
    expect(values).toMatchObject({
      upload_id: "upload-1",
      shop_id: "shop-1",
      target_month: "2025-11",
      llm_provider: "gemini",
      has_number_warning: true,
      input_tokens: 100,
      output_tokens: 50,
      generated_by: "user-1",
    });
    expect((values.result as { numberWarnings: unknown[] }).numberWarnings.length).toBe(3);
  });

  it("その月の uploads がなければ保存せず日本語のエラー", async () => {
    const { db, insert } = fakeDb({ uploads: [] });
    const result = await saveReport(db, member, "2025-11", await generated());
    expect(result).toMatchObject({ ok: false, message: expect.stringContaining("売上データが見つかりません") });
    expect(insert).not.toHaveBeenCalled();
  });

  it("保存に失敗したら日本語のエラー（詳細は出さない）", async () => {
    const { db } = fakeDb({ uploads: [{ id: "upload-1" }], insertError: true });
    const result = await saveReport(db, member, "2025-11", await generated());
    expect(result).toMatchObject({ ok: false, message: expect.stringContaining("保存できませんでした") });
  });
});
