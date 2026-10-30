// デモ版のダミーCSV（demo/public/sample-sales-demo.csv）の正解値テスト
// 正解値は lib/aggregate の出力から写さず、CSV の行を手で足し算・割り算して決めた（導出は各テストのコメント）。
// CSV は 2025年9〜11月・44行（9月15行／10月14行／11月15行）。トップス=T、ボトムス=B、アウター=O、小物=A と略す
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
  roundPercent,
} from "@/lib/aggregate";
import { parseSalesCsv } from "@/lib/csv/parse";
import { readAndParse } from "@/lib/upload/read-csv";

const csvPath = path.resolve(__dirname, "../../demo/public/sample-sales-demo.csv");
const text = readFileSync(csvPath, "utf8");
const parsed = parseSalesCsv(text);
if (!parsed.ok) throw new Error("ダミーCSVを読めません");
const rows = parsed.rows;

describe("ダミーCSVの読み込み", () => {
  it("44行すべて取り込め、スキップは0件・月は9〜11月", () => {
    expect(rows).toHaveLength(44);
    expect(parsed.skipped).toHaveLength(0);
    expect(parsed.months).toEqual(["2025-09", "2025-10", "2025-11"]);
  });

  it("共通の読み取り（readAndParse）でも同じ結果になる", async () => {
    const result = await readAndParse({ name: "sample-sales-demo.csv", size: text.length, text: async () => text });
    expect("ok" in result).toBe(false); // 失敗なら ok:false が付く。成功は Parsed
    if ("ok" in result) return;
    expect(result.rows).toHaveLength(44);
    expect(result.skipped).toHaveLength(0);
  });

  it("customer_id 空欄の行が5行ある（9/6・9/20・10/7・11/5・11/27）", () => {
    expect(rows.filter((r) => r.customerId === null)).toHaveLength(5);
  });
});

describe("月別の売上・粗利（手計算）", () => {
  const kpis = calcMonthlyKpis(rows);
  const byMonth = Object.fromEntries(kpis.map((k) => [k.month, k]));

  it("売上：9月110,000／10月104,000／11月120,000（合計334,000）", () => {
    // 9月：6000+8000+8000+3000+20000+7000+6000+12000+5000+4000+4000+8000+6000+3000+10000 = 110000
    // 10月：7000+20000+6000+6000+12000+5000+8000+4000+3000+12000+7000+5000+6000+3000 = 104000
    // 11月：20000+6000+8000+8000+7000+10000+20000+6000+6000+5000+4000+8000+3000+5000+4000 = 120000
    expect(byMonth["2025-09"].revenue).toBe(110000);
    expect(byMonth["2025-10"].revenue).toBe(104000);
    expect(byMonth["2025-11"].revenue).toBe(120000);
    expect(kpis.reduce((s, k) => s + k.revenue, 0)).toBe(334000); // 110000+104000+120000
  });

  it("粗利（売上−原価）：9月66,800／10月63,200／11月72,600（合計202,600）", () => {
    // 原価：9月 43200／10月 40800／11月 47400（合計131400）
    // 粗利：110000−43200=66800／104000−40800=63200／120000−47400=72600
    expect(byMonth["2025-09"].grossProfit).toBe(66800);
    expect(byMonth["2025-10"].grossProfit).toBe(63200);
    expect(byMonth["2025-11"].grossProfit).toBe(72600);
    expect(kpis.reduce((s, k) => s + k.grossProfit, 0)).toBe(202600); // 334000−131400
  });

  it("前月比：10月 −5.5%（−6000÷110000）／11月 +15.4%（16000÷104000）／9月は前月なし", () => {
    expect(roundPercent(byMonth["2025-10"].revenueChange.ratio)).toBe(-5.5); // −5.4545…
    expect(roundPercent(byMonth["2025-11"].revenueChange.ratio)).toBe(15.4); // 15.3846…
    expect(byMonth["2025-09"].revenueChange).toEqual({ ratio: null, reason: "noPreviousMonth" });
  });
});

describe("リピート率（手計算・customer_id 空欄は除く）", () => {
  const monthly = Object.fromEntries(calcMonthlyRepeat(rows).map((r) => [r.month, r]));

  it("月ごと【案】：9月 0%（0人/11人）／10月 54.5%（6人/11人）／11月 66.7%（8人/12人）", () => {
    // 9月の購入者：A〜K の11人。それ以前の月がないのでリピート0人 → 0÷11 = 0%
    // 10月の購入者：A,C,D,F,B,J（9月にも購入）＋L,M,N,O,P（新規）の11人。リピート6人 → 6÷11 = 54.54…%
    // 11月の購入者：A,E,G（9月）／L,M,N,O,P（10月）＋Q,R,S,T（新規）の12人。リピート8人 → 8÷12 = 66.66…%
    expect([monthly["2025-09"].repeaters, monthly["2025-09"].buyers]).toEqual([0, 11]);
    expect(roundPercent(monthly["2025-09"].rate.ratio)).toBe(0);
    expect([monthly["2025-10"].repeaters, monthly["2025-10"].buyers]).toEqual([6, 11]);
    expect(roundPercent(monthly["2025-10"].rate.ratio)).toBe(54.5);
    expect([monthly["2025-11"].repeaters, monthly["2025-11"].buyers]).toEqual([8, 12]);
    expect(roundPercent(monthly["2025-11"].rate.ratio)).toBe(66.7);
  });

  it("前月差：10月 +54.5pt（6/11−0）／11月 +12.1pt（8/12−6/11=16/132）", () => {
    expect(roundPercent(monthly["2025-10"].changePoints.ratio)).toBe(54.5);
    expect(roundPercent(monthly["2025-11"].changePoints.ratio)).toBe(12.1);
  });

  it("期間全体：65.0%（20人中13人）", () => {
    // 顧客：9月の11人（A〜K）＋10月の新規5人（L〜P）＋11月の新規4人（Q〜T）= 20人
    // 2か月以上購入：A,B,C,D,E,F,G,J（9月から）＋L,M,N,O,P（10月・11月）= 13人（H,I,K,Q,R,S,T は1か月だけ）
    // 13÷20 = 65%
    const overall = calcRepeatOverall(rows);
    expect(overall.customers).toBe(20);
    expect(overall.repeaters).toBe(13);
    expect(roundPercent(overall.rate.ratio)).toBe(65);
  });
});

describe("カテゴリ別・売れ筋（手計算）", () => {
  it("カテゴリ別売上（全期間）：トップス108,000／アウター80,000／小物78,000／ボトムス68,000", () => {
    // トップス：9月 40000＋10月 40000＋11月 28000 = 108000
    // アウター：9月 20000＋10月 20000＋11月 40000 = 80000
    // 小物　　：9月 27000＋10月 22000＋11月 29000 = 78000
    // ボトムス：9月 23000＋10月 22000＋11月 23000 = 68000（合計 334000）
    expect(calcCategorySales(rows, ALL_PERIOD)).toEqual([
      { category: "トップス", revenue: 108000 },
      { category: "アウター", revenue: 80000 },
      { category: "小物", revenue: 78000 },
      { category: "ボトムス", revenue: 68000 },
    ]);
  });

  it("売れ筋（全期間・数量の多い順）", () => {
    // SKU 別の数量（9月＋10月＋11月）：
    //   TOP-02 4+4+4=12／ACC-01 4+4+3=11／TOP-01 4+4+2=10／ACC-02 3+2+4=9／BTM-01 2+1+2=5／
    //   OUT-01 1+1+2=4／BTM-02 1+2+1=4（数量が同じ4個は売上の多い OUT-01 80000 → BTM-02 28000）
    const top = calcSkuTop(rows, ALL_PERIOD).map((s) => [s.sku, s.quantity, s.revenue]);
    expect(top).toEqual([
      ["DEMO-TOP-02", 12, 48000],
      ["DEMO-ACC-01", 11, 33000],
      ["DEMO-TOP-01", 10, 60000],
      ["DEMO-ACC-02", 9, 45000],
      ["DEMO-BTM-01", 5, 40000],
      ["DEMO-OUT-01", 4, 80000],
      ["DEMO-BTM-02", 4, 28000],
    ]);
  });
});
