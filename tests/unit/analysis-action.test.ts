// Day8：AI分析の Server Action・月ごとの生成・最新の分析の読み込み（すべてモック。実 API は呼ばない）
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const requireMember = vi.fn();
const generateJsonMock = vi.fn();
const revalidatePath = vi.fn();
vi.mock("@/lib/auth/guard", () => ({ requireMember: () => requireMember() }));
// @/lib/llm ごと差し替える（本物の SDK も環境変数も読まれない＝実 API に届かない）
vi.mock("@/lib/llm", () => ({ generateJson: (r: unknown) => generateJsonMock(r) }));
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidatePath(p) }));

import { generateAnalysisAction } from "@/actions/analysis";
import { generateMonthAnalysis } from "@/lib/analysis/generate-month";
import { loadLatestReport } from "@/lib/analysis/load";
import { FAILURE_MESSAGE } from "@/lib/analysis/run";
import type { GenerateJson, LlmResponse } from "@/lib/llm/types";

function fixture(name: string): string {
  return readFileSync(path.resolve(__dirname, "../fixtures/llm", name), "utf8");
}
function reply(text: string): LlmResponse {
  return { text, usage: { inputTokens: 100, outputTokens: 50 }, provider: "gemini", model: "gemini-3.5-flash-lite" };
}

// sales_data の行（DB の列名）。10月と11月（valid.json の数字と合う内容）
const salesRecords = [
  { id: 1, order_date: "2025-10-05", customer_id: "C-1", product_name: "ウールコート", category: "アウター", sku: "OUT-001", quantity: 1, revenue: 10000, cost: 4000 },
  { id: 2, order_date: "2025-11-07", customer_id: "C-1", product_name: "ウールコート", category: "アウター", sku: "OUT-001", quantity: 1, revenue: 15000, cost: 6000 },
  { id: 3, order_date: "2025-11-08", customer_id: "C-2", product_name: "Tシャツ", category: "トップス", sku: "TOP-001", quantity: 1, revenue: 5000, cost: 2000 },
];

type Results = Record<string, { data: unknown; error: unknown }>;

/** Supabase クライアントの代わり。どのメソッドを呼んでも連鎖でき、await すると表ごとの結果を返す */
function fakeDb(results: Results) {
  const inserts: { table: string; values: unknown }[] = [];
  const eqs: { table: string; column: string; value: unknown }[] = [];
  const db = {
    from: (table: string) => {
      const result = results[table] ?? { data: [], error: null };
      const chain: Record<string, unknown> = {
        insert: (values: unknown) => {
          inserts.push({ table, values });
          return chain;
        },
        then: (resolve: (v: unknown) => unknown) => resolve(table === "reports" && inserts.length ? results.reportsInsert : result),
      };
      for (const m of ["select", "gt", "order", "limit", "single"]) chain[m] = () => chain;
      chain.eq = (column: string, value: unknown) => {
        eqs.push({ table, column, value });
        return chain;
      };
      return chain;
    },
  };
  return { db: db as never, inserts, eqs };
}

const okResults: Results = {
  sales_data: { data: salesRecords, error: null },
  uploads: { data: [{ id: "upload-1" }], error: null },
  reportsInsert: { data: { id: "report-1" }, error: null },
};
const member = { shopId: "shop-1", userId: "user-1" };

beforeEach(() => {
  requireMember.mockReset();
  generateJsonMock.mockReset();
  revalidatePath.mockReset();
  vi.restoreAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("generateMonthAnalysis（月ごとの生成・保存）", () => {
  it("成功：保存され、画面用の結果を返す", async () => {
    const { db, inserts } = fakeDb(okResults);
    const generate = vi.fn<GenerateJson>().mockResolvedValue(reply(fixture("valid.json")));
    const result = await generateMonthAnalysis(db, member, "2025-11", generate);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.reportId).toBe("report-1");
    expect(result.hasNumberWarning).toBe(false);
    expect(result.report.highlights).toHaveLength(3);
    expect(inserts).toHaveLength(1);
    expect(inserts[0].table).toBe("reports");
    expect(inserts[0].values).toMatchObject({ shop_id: "shop-1", target_month: "2025-11", generated_by: "user-1" });
  });

  it("読み込み・保存とも、自分のお店（shop_id）で絞っている", async () => {
    const { db, inserts, eqs } = fakeDb(okResults);
    const generate = vi.fn<GenerateJson>().mockResolvedValue(reply(fixture("valid.json")));
    await generateMonthAnalysis(db, member, "2025-11", generate);

    const shopFilter = (table: string) => eqs.filter((e) => e.table === table && e.column === "shop_id");
    expect(shopFilter("sales_data")).toEqual([{ table: "sales_data", column: "shop_id", value: "shop-1" }]);
    expect(shopFilter("uploads")).toEqual([{ table: "uploads", column: "shop_id", value: "shop-1" }]);
    expect(inserts[0].values).toMatchObject({ shop_id: "shop-1" });
  });

  it("最新の分析の読み込みも shop_id と月で絞っている", async () => {
    const { db, eqs } = fakeDb({ reports: { data: [], error: null } });
    await loadLatestReport(db, "shop-1", "2025-11");
    expect(eqs).toEqual([
      { table: "reports", column: "shop_id", value: "shop-1" },
      { table: "reports", column: "target_month", value: "2025-11" },
    ]);
  });

  it("設定の誤り（LlmConfigError）：日本語の message のまま。内部の文字を含まない", async () => {
    const { db, inserts } = fakeDb(okResults);
    const config = Object.assign(new Error("環境変数がありません：GEMINI_API_KEY"), { name: "LlmConfigError" });
    const generate = vi.fn<GenerateJson>().mockRejectedValue(config);
    const result = await generateMonthAnalysis(db, member, "2025-11", generate);

    expect(result).toEqual({ ok: false, message: FAILURE_MESSAGE });
    expect(inserts).toHaveLength(0);
    const message = (result as { message: string }).message;
    for (const inner of ["LlmConfigError", "GEMINI_API_KEY", "LLM_PROVIDER", "環境変数"]) {
      expect(message).not.toContain(inner);
    }
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).toContain("config"); // ログには理由コードが残る
  });

  it("想定外の例外：日本語の message のまま。エラー名・内部の文を含まず、ログには名前だけ", async () => {
    const broken = {
      from: () => {
        throw Object.assign(new Error("connect failed: INTERNAL_RESPONSE_BODY"), { name: "InternalFailure" });
      },
    } as never;
    const generate = vi.fn<GenerateJson>();
    const result = await generateMonthAnalysis(broken, member, "2025-11", generate);

    expect(result.ok).toBe(false);
    const message = (result as { message: string }).message;
    expect(message).toContain("時間をおいて、もう一度生成してください");
    expect(message).not.toContain("InternalFailure");
    expect(message).not.toContain("INTERNAL_RESPONSE_BODY");
    expect(generate).not.toHaveBeenCalled();
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logged).toContain("InternalFailure");
    expect(logged).not.toContain("INTERNAL_RESPONSE_BODY");
  });

  it("不正な月は拒否：読み込みも生成も保存もしない", async () => {
    const { db, inserts } = fakeDb(okResults);
    const generate = vi.fn<GenerateJson>();
    for (const bad of ["2025-13", "2025-1", "abc", "", "2025-11-01"]) {
      const result = await generateMonthAnalysis(db, member, bad, generate);
      expect(result).toEqual({ ok: false, message: expect.stringContaining("月の指定が正しくありません") });
    }
    expect(generate).not.toHaveBeenCalled();
    expect(inserts).toHaveLength(0);
  });

  it("データのない月は日本語のエラー（生成しない）", async () => {
    const { db } = fakeDb(okResults);
    const generate = vi.fn<GenerateJson>();
    const result = await generateMonthAnalysis(db, member, "2026-01", generate);
    expect(result).toEqual({ ok: false, message: expect.stringContaining("売上データが見つかりません") });
    expect(generate).not.toHaveBeenCalled();
  });

  it("生成が3回失敗 → 日本語の message・保存しない・ログに応答の本文を出さない", async () => {
    const { db, inserts } = fakeDb(okResults);
    const generate = vi.fn<GenerateJson>().mockResolvedValue(reply(fixture("not-json.txt")));
    const result = await generateMonthAnalysis(db, member, "2025-11", generate);
    expect(result).toEqual({ ok: false, message: FAILURE_MESSAGE });
    expect(FAILURE_MESSAGE).toContain("時間をおいて、もう一度生成してください");
    expect(inserts).toHaveLength(0);
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logged).toContain("invalid");
    expect(logged).not.toContain("JSONではなく文章");
  });

  it("売上データの読み込みに失敗 → 保存しない", async () => {
    const { db, inserts } = fakeDb({ ...okResults, sales_data: { data: null, error: { message: "x" } } });
    const generate = vi.fn<GenerateJson>();
    const result = await generateMonthAnalysis(db, member, "2025-11", generate);
    expect(result.ok).toBe(false);
    expect(generate).not.toHaveBeenCalled();
    expect(inserts).toHaveLength(0);
  });

  it("保存に失敗 → 日本語のエラー", async () => {
    const { db } = fakeDb({ ...okResults, reportsInsert: { data: null, error: { message: "x" } } });
    const generate = vi.fn<GenerateJson>().mockResolvedValue(reply(fixture("valid.json")));
    const result = await generateMonthAnalysis(db, member, "2025-11", generate);
    expect(result).toEqual({ ok: false, message: expect.stringContaining("保存できませんでした") });
  });

  it("同時に2回呼んでも壊れない（2回とも成功・行が2つ増える）", async () => {
    const { db, inserts } = fakeDb(okResults);
    const generate = vi.fn<GenerateJson>().mockResolvedValue(reply(fixture("valid.json")));
    const [a, b] = await Promise.all([
      generateMonthAnalysis(db, member, "2025-11", generate),
      generateMonthAnalysis(db, member, "2025-11", generate),
    ]);
    expect(a.ok && b.ok).toBe(true);
    expect(inserts).toHaveLength(2);
  });
});

describe("generateAnalysisAction（Server Action）", () => {
  it("未ログイン・権限なし：requireMember が止めると、読み込みも LLM 呼び出しもしない", async () => {
    requireMember.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(generateAnalysisAction("2025-11")).rejects.toThrow("NEXT_REDIRECT");
    expect(generateJsonMock).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("不正な月：拒否（LLM を呼ばない）", async () => {
    const { db } = fakeDb(okResults);
    requireMember.mockResolvedValue({ ...member, supabase: db });
    const result = await generateAnalysisAction("2025-99");
    expect(result.ok).toBe(false);
    expect(generateJsonMock).not.toHaveBeenCalled();
  });

  it("成功：差し替えた generateJson だけが呼ばれ、保存後に画面を更新する", async () => {
    const { db, inserts } = fakeDb(okResults);
    requireMember.mockResolvedValue({ ...member, supabase: db });
    generateJsonMock.mockResolvedValue(reply(fixture("valid.json")));

    const result = await generateAnalysisAction("2025-11");

    expect(result.ok).toBe(true);
    expect(generateJsonMock).toHaveBeenCalledTimes(1);
    expect(inserts).toHaveLength(1);
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("生成の失敗：日本語の message・保存しない・画面の更新もしない", async () => {
    const { db, inserts } = fakeDb(okResults);
    requireMember.mockResolvedValue({ ...member, supabase: db });
    generateJsonMock.mockRejectedValue(new Error("upstream detail"));
    const result = await generateAnalysisAction("2025-11");
    expect(result).toEqual({ ok: false, message: FAILURE_MESSAGE });
    expect(inserts).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("loadLatestReport（最新の分析）", () => {
  const stored = { ...JSON.parse(fixture("valid.json")), numberWarnings: [] };
  const row = { id: "r-2", result: stored, llm_provider: "gemini", generated_at: "2025-12-01T00:00:00Z" };

  it("最新の1行を、型を確かめて返す", async () => {
    const { db } = fakeDb({ reports: { data: [row], error: null } });
    const latest = await loadLatestReport(db, "shop-1", "2025-11");
    expect(latest).toMatchObject({ id: "r-2", provider: "gemini", hasNumberWarning: false });
    expect(latest?.report.summary).toContain("2025年11月");
  });

  it("数字の警告があれば hasNumberWarning が true", async () => {
    const warned = { ...row, result: { ...stored, numberWarnings: [{ kind: "amount", text: "約30万円", field: "summary" }] } };
    const { db } = fakeDb({ reports: { data: [warned], error: null } });
    expect((await loadLatestReport(db, "shop-1", "2025-11"))?.hasNumberWarning).toBe(true);
  });

  it("行がない・読み込み失敗・壊れた result は「なし」（null）", async () => {
    const empty = fakeDb({ reports: { data: [], error: null } });
    expect(await loadLatestReport(empty.db, "shop-1", "2025-11")).toBeNull();
    const failed = fakeDb({ reports: { data: null, error: { message: "x" } } });
    expect(await loadLatestReport(failed.db, "shop-1", "2025-11")).toBeNull();
    const broken = fakeDb({ reports: { data: [{ ...row, result: { summary: "足りない" } }], error: null } });
    expect(await loadLatestReport(broken.db, "shop-1", "2025-11")).toBeNull();
    const badProvider = fakeDb({ reports: { data: [{ ...row, llm_provider: "other" }], error: null } });
    expect(await loadLatestReport(badProvider.db, "shop-1", "2025-11")).toBeNull();
  });
});
