/**
 * 自作サンプルCSV（tests/fixtures/lumina-sample-sales.csv）の正解値テスト。
 * 講座の配布CSVがなくても動く（公開用リポジトリ向け）。lib/aggregate を使わず、行を表に書き出して手計算した値。
 *
 * 物語：2025-09 と 2025-10 はほぼ横ばい、2025-11 にアウター（ウールコート・ナイロンパーカー）が大きく伸びる。
 * 48行（9月14行・10月14行・11月20行）。商品は9種類（SKU は LS-○○-01 の体系）、顧客は K101〜K125 の25人。
 *
 * 商品（単価 / 原価 は1点あたり。CSV の revenue・cost は数量分の合計）
 *   LS-TOP-01 リネンシャツ        トップス      5,000 / 2,000
 *   LS-TOP-02 ボーダーカットソー  トップス      3,000 / 1,500
 *   LS-TOP-03 ニットベスト        トップス      4,000 / 1,800
 *   LS-OUT-01 ウールコート        アウター     20,000 / 9,000
 *   LS-OUT-02 ナイロンパーカー    アウター     12,000 / 5,000
 *   LS-BTM-01 テーパードパンツ    ボトムス      6,000 / 2,500
 *   LS-BTM-02 プリーツスカート    ボトムス      5,000 / 2,200
 *   LS-ACC-01 レザーベルト        アクセサリー  3,500 / 1,200
 *   LS-ACC-02 ウールマフラー      アクセサリー  4,500 / 2,000
 *
 * 【月ごとの売上・原価・粗利（粗利 = 売上 − 原価）】
 *   月       行数  売上      原価      粗利
 *   2025-09   14    95,500    40,100    55,400
 *   2025-10   14    92,000    38,700    53,300
 *   2025-11   20   253,500   111,000   142,500
 *   合計      48   441,000   189,800   251,200
 *
 * 【月 × カテゴリの売上（検算：月→カテゴリ と カテゴリ→月 の2通りで足して一致）】
 *   カテゴリ      09月     10月     11月     全期間
 *   アウター     32,000   32,000  200,000   264,000
 *   トップス     27,000   32,000   21,000    80,000
 *   アクセサリー 19,500   16,000   21,500    57,000
 *   ボトムス     17,000   12,000   11,000    40,000
 *   月の合計     95,500   92,000  253,500   441,000   ← 月ごとの売上と一致
 *   （横に足した全期間の合計 264,000+80,000+57,000+40,000 = 441,000 も一致）
 *
 * 【前月比 =（当月 − 前月）÷ 前月 × 100。表示の直前だけ小数第1位に丸める】
 *   10月 売上 (92,000−95,500)/95,500 = −3.66% → −3.7%    粗利 (53,300−55,400)/55,400 = −3.79% → −3.8%
 *   11月 売上 (253,500−92,000)/92,000 = +175.54% → +175.5% 粗利 (142,500−53,300)/53,300 = +167.35% → +167.4%
 *   09月は前月なし → 「—」
 *
 * 【リピート率（月ごと）= その月の購入者のうち、それより前の月にも購入した人 ÷ その月の購入者】
 *   09月: 購入者 K101〜K112 の12人。前の月なし → 0人 → 0/12 = 0.0%
 *   10月: 購入者12人。K101,K103,K104,K105,K109 が9月にも購入＝5人、新規は K113〜K119 の7人
 *         → 5/12 = 41.67% → 41.7%
 *   11月: 購入者14人（K101,K102,K105,K109,K111 は9月から、K113,K116,K117 は10月から＝8人、
 *         新規 K120〜K125 の6人）→ 8/14 = 57.14% → 57.1%
 *   前月との差（pt）は丸める前の分数で引く：
 *     10月 5/12 − 0/12 = +41.67pt → +41.7pt
 *     11月 8/14 − 5/12 = 0.571429 − 0.416667 = +15.48pt → +15.5pt
 *     （丸めた値どうし 57.1 − 41.7 = 15.4 とは違う。丸めは最後の1回だけ）
 *
 * 【リピート率（期間全体）= 2か月以上にわたって購入した顧客 ÷ 全顧客】
 *   全顧客 = 9月12人 + 10月の新規7人 + 11月の新規6人 = 25人
 *   2か月以上 = K101,K102,K103,K104,K105,K109,K111,K113,K116,K117 の10人
 *   10/25 = 40.0%
 *
 * 【SKU別の数量と売上（全期間）→ トップ10（数量の多い順・同数なし）】
 *   SKU        09月数量 10月数量 11月数量 合計数量 合計売上
 *   LS-TOP-01     4        5        2       11     55,000
 *   LS-OUT-01     1        1        7        9    180,000
 *   LS-ACC-02     2        2        4        8     36,000
 *   LS-OUT-02     1        1        5        7     84,000
 *   LS-ACC-01     3        2        1        6     21,000
 *   LS-BTM-01     2        2        1        5     30,000
 *   LS-TOP-03     1        1        2        4     16,000
 *   LS-TOP-02     1        1        1        3      9,000
 *   LS-BTM-02     1        0        1        2     10,000
 *   合計         16       15       24       55    441,000
 *   （検算：縦に足した 11+9+8+7+6+5+4+3+2 = 55 と、横に足した 16+15+24 = 55 が一致）
 *
 * 【SKUトップ10（2025-11）：数量の多い順、同数は売上の多い順】
 *   1 LS-OUT-01 7点 140,000 / 2 LS-OUT-02 5点 60,000 / 3 LS-ACC-02 4点 18,000
 *   4 LS-TOP-01 2点 10,000 / 5 LS-TOP-03 2点 8,000（2点の同数は売上で TOP-01 が上）
 *   6 LS-BTM-01 1点 6,000 / 7 LS-BTM-02 1点 5,000 / 8 LS-ACC-01 1点 3,500 / 9 LS-TOP-02 1点 3,000
 *   （売上の合計 253,500、数量の合計 24 と一致）
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ALL_PERIOD,
  calcCategorySales,
  calcMonthlyKpis,
  calcMonthlyRepeat,
  calcRepeatOverall,
  calcSkuTop,
  makeChange,
  roundPercent,
} from "@/lib/aggregate";
import { parseSalesCsv } from "@/lib/csv/parse";

const csvText = readFileSync(path.resolve(__dirname, "../fixtures/lumina-sample-sales.csv"), "utf8");
const parsed = parseSalesCsv(csvText);
if (!parsed.ok) throw new Error("自作サンプルCSVを読めません");
const rows = parsed.rows;

const NOVEMBER = { kind: "month", month: "2025-11" } as const;

describe("自作サンプルCSVの取り込み", () => {
  it("8列がそろっている（本番と同じ列名・順）", () => {
    const header = csvText.split("\n")[0].trim();
    expect(header).toBe("order_date,customer_id,product_name,category,sku,quantity,revenue,cost");
  });

  it("48行すべて取り込め、スキップは0行、対象月は3か月", () => {
    expect(rows).toHaveLength(48);
    expect(parsed.skipped).toHaveLength(0);
    expect(parsed.months).toEqual(["2025-09", "2025-10", "2025-11"]);
  });
});

describe("月ごとの売上・粗利・前月比（手計算の正解値）", () => {
  const kpis = calcMonthlyKpis(rows);
  const byMonth = Object.fromEntries(kpis.map((k) => [k.month, k]));

  it("月は昇順で3か月", () => {
    expect(kpis.map((k) => k.month)).toEqual(["2025-09", "2025-10", "2025-11"]);
  });

  it("売上：9月95,500／10月92,000／11月253,500（合計441,000）", () => {
    expect(byMonth["2025-09"].revenue).toBe(95500);
    expect(byMonth["2025-10"].revenue).toBe(92000);
    expect(byMonth["2025-11"].revenue).toBe(253500);
    expect(kpis.reduce((s, k) => s + k.revenue, 0)).toBe(441000);
  });

  it("粗利：55,400／53,300／142,500（合計251,200）", () => {
    expect(byMonth["2025-09"].grossProfit).toBe(55400);
    expect(byMonth["2025-10"].grossProfit).toBe(53300);
    expect(byMonth["2025-11"].grossProfit).toBe(142500);
    expect(kpis.reduce((s, k) => s + k.grossProfit, 0)).toBe(251200);
  });

  it("売上の前月比：9月は前月なし、10月 −3.7%、11月 +175.5%", () => {
    expect(byMonth["2025-09"].revenueChange).toEqual({ ratio: null, reason: "noPreviousMonth" });
    expect(byMonth["2025-10"].revenueChange).toEqual(makeChange(92000, 95500));
    expect(roundPercent(byMonth["2025-10"].revenueChange.ratio)).toBe(-3.7);
    expect(byMonth["2025-11"].revenueChange).toEqual(makeChange(253500, 92000));
    expect(roundPercent(byMonth["2025-11"].revenueChange.ratio)).toBe(175.5);
  });

  it("粗利の前月比：9月は前月なし、10月 −3.8%、11月 +167.4%", () => {
    expect(byMonth["2025-09"].grossProfitChange).toEqual({ ratio: null, reason: "noPreviousMonth" });
    expect(byMonth["2025-10"].grossProfitChange).toEqual(makeChange(53300, 55400));
    expect(roundPercent(byMonth["2025-10"].grossProfitChange.ratio)).toBe(-3.8);
    expect(byMonth["2025-11"].grossProfitChange).toEqual(makeChange(142500, 53300));
    expect(roundPercent(byMonth["2025-11"].grossProfitChange.ratio)).toBe(167.4);
  });
});

describe("リピート率（手計算の正解値）", () => {
  const monthly = Object.fromEntries(calcMonthlyRepeat(rows).map((r) => [r.month, r]));

  it("月ごと：9月 0%（0/12）／10月 41.7%（5/12）／11月 57.1%（8/14）", () => {
    expect([monthly["2025-09"].repeaters, monthly["2025-09"].buyers]).toEqual([0, 12]);
    expect(roundPercent(monthly["2025-09"].rate.ratio)).toBe(0);
    expect([monthly["2025-10"].repeaters, monthly["2025-10"].buyers]).toEqual([5, 12]);
    expect(roundPercent(monthly["2025-10"].rate.ratio)).toBe(41.7);
    expect([monthly["2025-11"].repeaters, monthly["2025-11"].buyers]).toEqual([8, 14]);
    expect(roundPercent(monthly["2025-11"].rate.ratio)).toBe(57.1);
  });

  it("前月との差（pt）：9月は前月なし、10月 +41.7pt、11月 +15.5pt（丸め前の分数で引く）", () => {
    expect(monthly["2025-09"].changePoints).toEqual({ ratio: null, reason: "noPreviousMonth" });
    expect(roundPercent(monthly["2025-10"].changePoints.ratio)).toBe(41.7);
    expect(roundPercent(monthly["2025-11"].changePoints.ratio)).toBe(15.5);
  });

  it("期間全体：25人中10人＝40.0%", () => {
    const overall = calcRepeatOverall(rows);
    expect([overall.repeaters, overall.customers]).toEqual([10, 25]);
    expect(roundPercent(overall.rate.ratio)).toBe(40);
  });
});

describe("カテゴリ別売上（手計算の正解値）", () => {
  it("全期間：アウター264,000／トップス80,000／アクセサリー57,000／ボトムス40,000（合計441,000）", () => {
    const result = calcCategorySales(rows, ALL_PERIOD);
    expect(result).toEqual([
      { category: "アウター", revenue: 264000 },
      { category: "トップス", revenue: 80000 },
      { category: "アクセサリー", revenue: 57000 },
      { category: "ボトムス", revenue: 40000 },
    ]);
    expect(result.reduce((s, c) => s + c.revenue, 0)).toBe(441000);
  });

  it("2025-11：アウター200,000／アクセサリー21,500／トップス21,000／ボトムス11,000（合計253,500）", () => {
    const result = calcCategorySales(rows, NOVEMBER);
    expect(result).toEqual([
      { category: "アウター", revenue: 200000 },
      { category: "アクセサリー", revenue: 21500 },
      { category: "トップス", revenue: 21000 },
      { category: "ボトムス", revenue: 11000 },
    ]);
    expect(result.reduce((s, c) => s + c.revenue, 0)).toBe(253500);
  });
});

describe("SKUトップ10（手計算の正解値）", () => {
  it("全期間：数量の多い順に9種類、同数なし。1位は LS-TOP-01（11点）", () => {
    const result = calcSkuTop(rows, ALL_PERIOD);
    expect(result.map((r) => [r.sku, r.quantity, r.revenue])).toEqual([
      ["LS-TOP-01", 11, 55000],
      ["LS-OUT-01", 9, 180000],
      ["LS-ACC-02", 8, 36000],
      ["LS-OUT-02", 7, 84000],
      ["LS-ACC-01", 6, 21000],
      ["LS-BTM-01", 5, 30000],
      ["LS-TOP-03", 4, 16000],
      ["LS-TOP-02", 3, 9000],
      ["LS-BTM-02", 2, 10000],
    ]);
    expect(result[0]).toEqual({
      sku: "LS-TOP-01",
      productName: "リネンシャツ",
      category: "トップス",
      quantity: 11,
      revenue: 55000,
    });
    expect(new Set(result.map((r) => r.quantity)).size).toBe(result.length);
    expect(result.reduce((s, r) => s + r.quantity, 0)).toBe(55);
    expect(result.reduce((s, r) => s + r.revenue, 0)).toBe(441000);
  });

  it("2025-11：数量の多い順、同数（2点・1点）は売上の多い順", () => {
    const result = calcSkuTop(rows, NOVEMBER);
    expect(result.map((r) => [r.sku, r.quantity, r.revenue])).toEqual([
      ["LS-OUT-01", 7, 140000],
      ["LS-OUT-02", 5, 60000],
      ["LS-ACC-02", 4, 18000],
      ["LS-TOP-01", 2, 10000],
      ["LS-TOP-03", 2, 8000],
      ["LS-BTM-01", 1, 6000],
      ["LS-BTM-02", 1, 5000],
      ["LS-ACC-01", 1, 3500],
      ["LS-TOP-02", 1, 3000],
    ]);
    expect(result.reduce((s, r) => s + r.quantity, 0)).toBe(24);
    expect(result.reduce((s, r) => s + r.revenue, 0)).toBe(253500);
  });
});
