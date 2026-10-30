import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  calcMonthlyKpis,
  calcMonthlyRepeat,
  calcRepeatOverall,
  explainReason,
  isValidMonth,
  loadSalesRows,
  makeChange,
  makeRatio,
  previousMonth,
  roundPercent,
  rowsInPeriod,
  toSalesRow,
} from "@/lib/aggregate";
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

function row(orderDate: string, customerId: string | null, revenue: number, cost = 0): SalesRow {
  return { orderDate, customerId, productName: "p", category: "c", sku: "s", quantity: 1, revenue, cost };
}

describe.skipIf(!hasCourseCsv)("配布CSVの正解値（requirements 第5項）", () => {
  const kpis = calcMonthlyKpis(rows);
  const byMonth = Object.fromEntries(kpis.map((k) => [k.month, k]));

  it("配布CSVは40行すべて取り込める", () => {
    expect(rows).toHaveLength(40);
  });

  it("売上：9月148,400／10月147,500／11月264,700（合計560,600）", () => {
    expect(byMonth["2025-09"].revenue).toBe(148400);
    expect(byMonth["2025-10"].revenue).toBe(147500);
    expect(byMonth["2025-11"].revenue).toBe(264700);
    expect(kpis.reduce((s, k) => s + k.revenue, 0)).toBe(560600);
  });

  it("粗利：93,400／92,600／163,100（合計349,100）", () => {
    expect(byMonth["2025-09"].grossProfit).toBe(93400);
    expect(byMonth["2025-10"].grossProfit).toBe(92600);
    expect(byMonth["2025-11"].grossProfit).toBe(163100);
    expect(kpis.reduce((s, k) => s + k.grossProfit, 0)).toBe(349100);
  });

  it("月は昇順で3か月", () => {
    expect(kpis.map((k) => k.month)).toEqual(["2025-09", "2025-10", "2025-11"]);
  });

  it("11月の売上の前月比は +79.5%、9月は前月なしで null", () => {
    expect(roundPercent(byMonth["2025-11"].revenueChange.ratio)).toBe(79.5);
    expect(byMonth["2025-09"].revenueChange).toEqual({ ratio: null, reason: "noPreviousMonth" });
    expect(byMonth["2025-09"].grossProfitChange).toEqual({ ratio: null, reason: "noPreviousMonth" });
  });

  it("リピート率（期間全体）は 28.6%（28人中8人）", () => {
    const overall = calcRepeatOverall(rows);
    expect(overall.customers).toBe(28);
    expect(overall.repeaters).toBe(8);
    expect(roundPercent(overall.rate.ratio)).toBe(28.6);
  });

  it("リピート率（月ごと）は 0%／38.5%（13人中5人）／46.7%（15人中7人）", () => {
    const m = Object.fromEntries(calcMonthlyRepeat(rows).map((r) => [r.month, r]));
    expect(roundPercent(m["2025-09"].rate.ratio)).toBe(0);
    expect(roundPercent(m["2025-10"].rate.ratio)).toBe(38.5);
    expect([m["2025-10"].repeaters, m["2025-10"].buyers]).toEqual([5, 13]);
    expect(roundPercent(m["2025-11"].rate.ratio)).toBe(46.7);
    expect([m["2025-11"].repeaters, m["2025-11"].buyers]).toEqual([7, 15]);
  });

  it("11月のリピート率の前月差は +8.2pt、9月は null", () => {
    const m = Object.fromEntries(calcMonthlyRepeat(rows).map((r) => [r.month, r]));
    expect(roundPercent(m["2025-11"].changePoints.ratio)).toBe(8.2);
    expect(m["2025-09"].changePoints).toEqual({ ratio: null, reason: "noPreviousMonth" });
  });
});

describe("前月・境界", () => {
  it("暦の前月：年またぎは前年12月", () => {
    expect(previousMonth("2025-11")).toBe("2025-10");
    expect(previousMonth("2026-01")).toBe("2025-12");
  });

  it("年またぎ（12月→1月）の前月比を計算する", () => {
    const kpis = calcMonthlyKpis([row("2025-12-05", "a", 1000), row("2026-01-05", "a", 1500)]);
    expect(roundPercent(kpis[1].revenueChange.ratio)).toBe(50);
  });

  it("前月のデータがない月（飛び月）は ratio が null・理由 noPreviousMonth：10月の次が12月", () => {
    const kpis = calcMonthlyKpis([row("2025-10-05", "a", 1000), row("2025-12-05", "a", 2000)]);
    expect(kpis[1].revenueChange).toEqual({ ratio: null, reason: "noPreviousMonth" });
    expect(kpis[1].grossProfitChange).toEqual({ ratio: null, reason: "noPreviousMonth" });
  });

  it("前月が0：売上・粗利とも ratio null・理由 previousZero", () => {
    const zero = calcMonthlyKpis([row("2025-10-05", "a", 0, 0), row("2025-11-05", "a", 500, 100)]);
    expect(zero[1].revenueChange).toEqual({ ratio: null, reason: "previousZero" });
    expect(zero[1].grossProfitChange).toEqual({ ratio: null, reason: "previousZero" });
  });

  it("前月がマイナス：粗利・売上とも ratio null・理由 previousNegative（前月が正の側は計算できる）", () => {
    const negative = calcMonthlyKpis([row("2025-10-05", "a", 100, 300), row("2025-11-05", "a", 500, 100)]);
    expect(negative[1].grossProfitChange).toEqual({ ratio: null, reason: "previousNegative" });
    expect(roundPercent(negative[1].revenueChange.ratio)).toBe(400);
    const negRevenue = calcMonthlyKpis([row("2025-10-05", "a", -100, 0), row("2025-11-05", "a", 500, 0)]);
    expect(negRevenue[1].revenueChange).toEqual({ ratio: null, reason: "previousNegative" });
  });

  it("makeChange：前月が正なら ratio を返し reason は null", () => {
    expect(makeChange(150, 100)).toEqual({ ratio: { numerator: 50, denominator: 100 }, reason: null });
  });

  it("explainReason：理由コードを日本語の短い説明にする", () => {
    expect(explainReason("noPreviousMonth")).toBe("前月のデータがありません");
    expect(explainReason("previousZero")).toBe("前月が0のため計算できません");
    expect(explainReason("previousNegative")).toBe("前月がマイナスのため計算できません");
    expect(explainReason("noPreviousBuyers")).toBe("前月の購入者がいないため計算できません");
    expect(explainReason("noBuyers")).toBe("この月の購入者がいないため計算できません");
    expect(explainReason("noCustomerId")).toBe("顧客IDのある購入者がいないため計算できません");
  });

  it("減少は負の値、0%は 0（-0 にしない）", () => {
    const kpis = calcMonthlyKpis([
      row("2025-09-01", "a", 1000),
      row("2025-10-01", "a", 500),
      row("2025-11-01", "a", 500),
    ]);
    expect(roundPercent(kpis[1].revenueChange.ratio)).toBe(-50);
    expect(Object.is(roundPercent(kpis[2].revenueChange.ratio), 0)).toBe(true);
  });

  it("customer_id 空欄の行はリピート率から除外（売上には含める）", () => {
    const data = [
      row("2025-10-01", null, 1000),
      row("2025-11-01", null, 1000),
      row("2025-10-02", "a", 100),
      row("2025-11-02", "a", 100),
      row("2025-11-03", "b", 100),
    ];
    const overall = calcRepeatOverall(data);
    expect([overall.repeaters, overall.customers]).toEqual([1, 2]);
    const nov = calcMonthlyRepeat(data)[1];
    expect([nov.repeaters, nov.buyers]).toEqual([1, 2]);
    expect(calcMonthlyKpis(data)[0].revenue).toBe(1100);
  });

  it("月ごとのリピートは「それより前の月」のみ（同じ月の複数回購入はリピートではない）", () => {
    const data = [row("2025-10-01", "a", 100), row("2025-10-20", "a", 100)];
    const [oct] = calcMonthlyRepeat(data);
    expect([oct.repeaters, oct.buyers]).toEqual([0, 1]);
    expect(calcRepeatOverall(data).repeaters).toBe(0);
  });

  it("前の月に飛び月があってもリピートと数える（お店の全データ）。前月差は前月が無ければ null", () => {
    const data = [row("2025-08-01", "a", 100), row("2025-10-01", "a", 100)];
    const oct = calcMonthlyRepeat(data)[1];
    expect(roundPercent(oct.rate.ratio)).toBe(100);
    expect(oct.changePoints).toEqual({ ratio: null, reason: "noPreviousMonth" });
  });

  it("購入者が0人の月（customer_id がすべて空欄）の率は null。前月差は月なし→noPreviousMonth", () => {
    const [oct] = calcMonthlyRepeat([row("2025-10-01", null, 100)]);
    expect(oct.rate).toEqual({ ratio: null, reason: "noCustomerId" });
    expect(oct.changePoints).toEqual({ ratio: null, reason: "noPreviousMonth" });
  });

  it("リピート率の前月差：前月の購入者0人→noPreviousBuyers、当月の購入者0人→noBuyers", () => {
    const prevEmpty = calcMonthlyRepeat([row("2025-10-01", null, 100), row("2025-11-01", "a", 100)]);
    expect(prevEmpty[1].changePoints).toEqual({ ratio: null, reason: "noPreviousBuyers" });
    const currentEmpty = calcMonthlyRepeat([row("2025-10-01", "a", 100), row("2025-11-01", null, 100)]);
    expect(currentEmpty[1].changePoints).toEqual({ ratio: null, reason: "noBuyers" });
  });

  it("空のデータはエラーにならず空・null", () => {
    expect(calcMonthlyKpis([])).toEqual([]);
    expect(calcMonthlyRepeat([])).toEqual([]);
    const overall = calcRepeatOverall([]);
    expect(overall).toEqual({
      repeaters: 0,
      customers: 0,
      rate: { ratio: null, reason: "noCustomerId" },
    });
    expect(roundPercent(overall.rate.ratio)).toBeNull();
  });
});

describe("roundPercent（表示の直前の丸め）", () => {
  it("小数第1位へ四捨五入（0.05 は切り上げ）", () => {
    expect(roundPercent(makeRatio(1, 8))).toBe(12.5);
    expect(roundPercent(makeRatio(1, 1600))).toBe(0.1); // 0.0625% → 0.1
    expect(roundPercent(makeRatio(1, 3))).toBe(33.3);
    expect(roundPercent(makeRatio(2, 3))).toBe(66.7);
  });

  it("四捨五入の境界：0.05→0.1／0.125→0.1／0.375→0.4／負は絶対値で -0.05→-0.1", () => {
    expect(roundPercent(makeRatio(1, 2000))).toBe(0.1);
    expect(roundPercent(makeRatio(1, 800))).toBe(0.1);
    expect(roundPercent(makeRatio(3, 800))).toBe(0.4);
    expect(roundPercent({ numerator: -1, denominator: 2000 })).toBe(-0.1);
  });

  it("小数・NaN・無限大・分母0以下の Ratio は例外にせず null", () => {
    expect(roundPercent({ numerator: 1.5, denominator: 3 })).toBeNull();
    expect(roundPercent({ numerator: 1, denominator: 2.5 })).toBeNull();
    expect(roundPercent({ numerator: NaN, denominator: 3 })).toBeNull();
    expect(roundPercent({ numerator: 1, denominator: Infinity })).toBeNull();
    expect(roundPercent({ numerator: 1, denominator: 0 })).toBeNull();
  });

  // 行データを使わない部分は、配布 CSV がなくても常に実行する
  it("不正な月：isValidMonth は false、previousMonth は null", () => {
    expect(isValidMonth("2025-11")).toBe(true);
    for (const bad of ["abc", "2025-13", "2025-00", "2025-1", "2025-11-01", ""]) {
      expect(isValidMonth(bad)).toBe(false);
      expect(previousMonth(bad)).toBeNull();
    }
  });

  it.skipIf(!hasCourseCsv)("不正な月：期間の月が不正なら空の結果（配布 CSV の行を使う）", () => {
    for (const bad of ["abc", "2025-13", "2025-00", "2025-1", "2025-11-01", ""]) {
      expect(rowsInPeriod(rows, { kind: "month", month: bad })).toEqual([]);
    }
    expect(rowsInPeriod(rows, { kind: "month", month: "2025-11" }).length).toBeGreaterThan(0);
  });

  it("負の値は絶対値で四捨五入", () => {
    expect(roundPercent({ numerator: -1, denominator: 1600 })).toBe(-0.1);
  });

  it("分母が0以下は null", () => {
    expect(makeRatio(1, 0)).toBeNull();
    expect(makeRatio(1, -5)).toBeNull();
  });
});

describe("DBの行 → 集計の入力", () => {
  it("toSalesRow は列名を変換し、空の customer_id を null にする", () => {
    const r = toSalesRow({
      order_date: "2025-11-01",
      customer_id: "",
      product_name: "p",
      category: "c",
      sku: "s",
      quantity: 2,
      revenue: 100,
      cost: 40,
    });
    expect(r).toEqual({
      orderDate: "2025-11-01",
      customerId: null,
      productName: "p",
      category: "c",
      sku: "s",
      quantity: 2,
      revenue: 100,
      cost: 40,
    });
  });

  // id が飛び飛び（欠番あり）の n 行を持つ、gt / order / limit を再現した偽のDB
  const makeDb = (n: number, failOnCall?: number) => {
    const all = Array.from({ length: n }, (_, i) => ({
      id: (i + 1) * 3,
      order_date: "2025-11-01",
      customer_id: `c${(i + 1) * 3}`,
      product_name: "p",
      category: "c",
      sku: "s",
      quantity: 1,
      revenue: 1,
      cost: 0,
    }));
    const gtCalls: Array<[string, number]> = [];
    let calls = 0;
    const db = {
      from: () => {
        let after = -Infinity;
        const q = {
          select: () => q,
          eq: () => q,
          gt: (col: string, v: number) => {
            gtCalls.push([col, v]);
            after = v;
            return q;
          },
          order: () => q,
          limit: (size: number) => {
            calls += 1;
            if (calls === failOnCall) return Promise.resolve({ data: null, error: { message: "secret detail" } });
            return Promise.resolve({ data: all.filter((r) => r.id > after).slice(0, size), error: null });
          },
        };
        return q;
      },
    };
    return { db, gtCalls, getCalls: () => calls };
  };

  it.each([
    [0, 1],
    [999, 1],
    [1000, 2], // ちょうど1ページ分：2回目で0件を確認して終わる
    [1001, 2],
    [2000, 3],
    [2500, 3],
  ])("loadSalesRows は %i 行を抜け・重複なく読む（取得 %i 回）", async (n, expectedCalls) => {
    const { db, getCalls } = makeDb(n);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await loadSalesRows(db as any, "shop-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ids = result.rows.map((r) => r.customerId);
    expect(ids).toEqual(Array.from({ length: n }, (_, i) => `c${(i + 1) * 3}`));
    expect(new Set(ids).size).toBe(n);
    expect(getCalls()).toBe(expectedCalls);
  });

  it("loadSalesRows は最初のページに gt なし、2ページ目以降に前のページの最後の id を渡す", async () => {
    const { db, gtCalls } = makeDb(2100);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await loadSalesRows(db as any, "shop-1");
    // 1000行目の id = 3000、2000行目の id = 6000
    expect(gtCalls).toEqual([
      ["id", 3000],
      ["id", 6000],
    ]);
  });

  it("loadSalesRows は途中のページで失敗したら部分表示せず ok:false を返す", async () => {
    const { db } = makeDb(2500, 2);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await loadSalesRows(db as any, "shop-1");
    expect(result.ok).toBe(false);
    expect("rows" in result).toBe(false);
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("loadSalesRows は読み込み失敗時に日本語のエラーを返す（DBの詳細を出さない）", async () => {
    const q = {
      select: () => q,
      eq: () => q,
      order: () => q,
      limit: () => Promise.resolve({ data: null, error: { message: "secret detail" } }),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await loadSalesRows({ from: () => q } as any, "shop-1");
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("secret");
  });
});
