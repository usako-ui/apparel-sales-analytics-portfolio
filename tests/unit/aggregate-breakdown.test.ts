import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ALL_PERIOD, calcCategorySales, calcSkuTop } from "@/lib/aggregate";
import { parseSalesCsv } from "@/lib/csv/parse";
import type { SalesRow } from "@/lib/csv/validate";
import { hasCourseCsv } from "../helpers/course-csv";

// 配布CSVがない時（公開用リポジトリ）は空にして、使うテストだけ飛ばす
function loadCourseRows(): SalesRow[] {
  if (!hasCourseCsv) return [];
  const parsed = parseSalesCsv(readFileSync(path.resolve(__dirname, "../fixtures/sample-sales.csv"), "utf8"));
  if (!parsed.ok) throw new Error("配布CSVを読めません");
  return parsed.rows;
}
const rows = loadCourseRows();

function sku(
  code: string,
  quantity: number,
  revenue: number,
  orderDate = "2025-11-01",
  productName = `商品${code}`,
  category = "c",
): SalesRow {
  return { orderDate, customerId: null, productName, category, sku: code, quantity, revenue, cost: 0 };
}

describe("カテゴリ別売上（配布CSV・requirements 第5項）", () => {
  it.skipIf(!hasCourseCsv)("全期間：アウター287,400／トップス114,400／ボトムス82,200／アクセサリー76,600（売上の多い順）", () => {
    const result = calcCategorySales(rows, ALL_PERIOD);
    expect(result).toEqual([
      { category: "アウター", revenue: 287400 },
      { category: "トップス", revenue: 114400 },
      { category: "ボトムス", revenue: 82200 },
      { category: "アクセサリー", revenue: 76600 },
    ]);
    expect(result.reduce((s, c) => s + c.revenue, 0)).toBe(560600);
  });

  it.skipIf(!hasCourseCsv)("2025-11：アウター198,200／トップス35,600／ボトムス16,100／アクセサリー14,800（合計264,700）", () => {
    const result = calcCategorySales(rows, { kind: "month", month: "2025-11" });
    expect(result).toEqual([
      { category: "アウター", revenue: 198200 },
      { category: "トップス", revenue: 35600 },
      { category: "ボトムス", revenue: 16100 },
      { category: "アクセサリー", revenue: 14800 },
    ]);
    expect(result.reduce((s, c) => s + c.revenue, 0)).toBe(264700);
  });

  it("同額ならカテゴリ名の文字順", () => {
    const data = [sku("a", 1, 100, "2025-11-01", "p", "b"), sku("b", 1, 100, "2025-11-01", "p", "a")];
    expect(calcCategorySales(data, ALL_PERIOD).map((c) => c.category)).toEqual(["a", "b"]);
  });

  it.skipIf(!hasCourseCsv)("データ0件・存在しない月は空の配列", () => {
    expect(calcCategorySales([], ALL_PERIOD)).toEqual([]);
    expect(calcCategorySales(rows, { kind: "month", month: "2024-01" })).toEqual([]);
  });
});

describe("SKUトップ10（配布CSV・requirements 第5項）", () => {
  it.skipIf(!hasCourseCsv)("全期間：1位 LUM-TOP-01（14点）・2位 LUM-TOP-02（9点）・3位 LUM-ACC-01（8点）、8種類で8件", () => {
    const result = calcSkuTop(rows, ALL_PERIOD);
    expect(result).toHaveLength(8);
    expect(result.slice(0, 3).map((r) => [r.sku, r.quantity])).toEqual([
      ["LUM-TOP-01", 14],
      ["LUM-TOP-02", 9],
      ["LUM-ACC-01", 8],
    ]);
    expect(result[0]).toEqual({
      sku: "LUM-TOP-01",
      productName: "オーガニックコットンTシャツ",
      category: "トップス",
      quantity: 14,
      revenue: 53200,
    });
    expect(result.reduce((s, r) => s + r.revenue, 0)).toBe(560600);
  });

  it.skipIf(!hasCourseCsv)("2025-11：数量の多い順、同数（4点）は売上の多い順（OUT-01 が TOP-01 より上）", () => {
    const result = calcSkuTop(rows, { kind: "month", month: "2025-11" });
    expect(result.map((r) => [r.sku, r.quantity, r.revenue])).toEqual([
      ["LUM-OUT-02", 5, 99000],
      ["LUM-OUT-01", 4, 99200],
      ["LUM-TOP-01", 4, 15200],
      ["LUM-TOP-02", 3, 20400],
      ["LUM-ACC-01", 2, 9000],
      ["LUM-BTM-01", 1, 8900],
      ["LUM-BTM-02", 1, 7200],
      ["LUM-ACC-02", 1, 5800],
    ]);
  });

  it("11件以上は10件に切る", () => {
    const data = Array.from({ length: 12 }, (_, i) => sku(`S${String(i).padStart(2, "0")}`, i + 1, 100));
    const result = calcSkuTop(data, ALL_PERIOD);
    expect(result).toHaveLength(10);
    expect(result[0].sku).toBe("S11");
    expect(result[9].sku).toBe("S02");
  });

  it("数量も売上も同じなら SKU の文字順", () => {
    const data = [sku("B", 1, 100), sku("A", 1, 100)];
    expect(calcSkuTop(data, ALL_PERIOD).map((r) => r.sku)).toEqual(["A", "B"]);
  });

  it("同じ SKU の商品名・カテゴリは期間内で最も新しい日付の行を使う", () => {
    const data = [
      sku("X", 1, 100, "2025-11-20", "新名称", "新"),
      sku("X", 1, 100, "2025-11-01", "旧名称", "旧"),
    ];
    const [top] = calcSkuTop(data, ALL_PERIOD);
    expect([top.productName, top.category, top.quantity, top.revenue]).toEqual(["新名称", "新", 2, 200]);
  });

  it.skipIf(!hasCourseCsv)("データ0件・存在しない月は空の配列", () => {
    expect(calcSkuTop([], ALL_PERIOD)).toEqual([]);
    expect(calcSkuTop(rows, { kind: "month", month: "2024-01" })).toEqual([]);
  });
});
