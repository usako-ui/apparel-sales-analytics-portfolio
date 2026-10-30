// 数字の表示用の整形（T-21）。丸めは集計側の roundPercent に任せ、ここは見た目だけ
import { describe, expect, it } from "vitest";
import { dashboardHref, pickMonth, pickPeriodKind, toDisplayPeriod } from "@/components/dashboard/select-month";
import { calcMonthlyKpis, calcMonthlyRepeat, explainReason } from "@/lib/aggregate";
import { toTrendPoints } from "@/components/dashboard/trend-data";
import { formatManYen, formatPercent, formatSignedPercent, formatYen, viewChange } from "@/lib/format";
import type { SalesRow } from "@/lib/csv/validate";

const row = (orderDate: string, revenue: number, cost: number, customerId: string | null = "c1"): SalesRow => ({
  orderDate,
  customerId,
  productName: "商品",
  category: "カテゴリ",
  sku: "SKU-1",
  quantity: 1,
  revenue,
  cost,
});

describe("viewChange（前月比の色分け・「—」と理由）T-22", () => {
  it("増加は up・減少は down・0.0 は flat。記号（+／-）も文字に残す", () => {
    expect(viewChange({ ratio: { numerator: 117200, denominator: 147500 }, reason: null }, "%")).toEqual({
      text: "+79.5%",
      tone: "up",
      reason: null,
    });
    expect(viewChange({ ratio: { numerator: -32, denominator: 1000 }, reason: null }, "%")).toMatchObject({
      text: "-3.2%",
      tone: "down",
    });
    expect(viewChange({ ratio: { numerator: 0, denominator: 10 }, reason: null }, "%")).toMatchObject({
      text: "0.0%",
      tone: "flat",
    });
  });

  it("丸めて 0.0 になる小さな増減（+0.04%）は、表示と同じく flat（緑にしない）", () => {
    expect(viewChange({ ratio: { numerator: 4, denominator: 10000 }, reason: null }, "%")).toMatchObject({
      text: "0.0%",
      tone: "flat",
    });
  });

  it("リピート率の前月差は pt の単位", () => {
    expect(viewChange({ ratio: { numerator: 82, denominator: 1000 }, reason: null }, "pt")).toMatchObject({
      text: "+8.2pt",
      tone: "up",
    });
  });

  it("計算できない時は text が null（画面は「—」）で、理由は explainReason の文", () => {
    const view = viewChange({ ratio: null, reason: "previousZero" }, "%");
    expect(view).toEqual({ text: null, tone: null, reason: explainReason("previousZero") });
  });

  it("集計の結果につなぐ：最初の月は前月なしの理由、翌月は +50.0%（up）", () => {
    const kpis = calcMonthlyKpis([row("2025-09-01", 1000, 400), row("2025-10-01", 1500, 500)]);
    expect(viewChange(kpis[0].revenueChange, "%")).toEqual({
      text: null,
      tone: null,
      reason: "前月のデータがありません",
    });
    expect(viewChange(kpis[1].revenueChange, "%")).toMatchObject({ text: "+50.0%", tone: "up" });
  });

  it("前月が0・マイナスの月は「—」と、それぞれの理由", () => {
    const zero = calcMonthlyKpis([row("2025-09-01", 0, 0), row("2025-10-01", 1500, 500)]);
    expect(viewChange(zero[1].revenueChange, "%").reason).toBe("前月が0のため計算できません");
    const negative = calcMonthlyKpis([row("2025-09-01", 100, 400), row("2025-10-01", 1500, 500)]);
    expect(viewChange(negative[1].grossProfitChange, "%").reason).toBe("前月がマイナスのため計算できません");
  });

  it("リピート率：最初の月の前月差は「—」（前月のデータなし）", () => {
    const repeat = calcMonthlyRepeat([row("2025-09-01", 1000, 400)]);
    expect(viewChange(repeat[0].changePoints, "pt")).toEqual({
      text: null,
      tone: null,
      reason: "前月のデータがありません",
    });
  });
});

describe("pickMonth（表示する月の決め方）T-22", () => {
  const months = ["2025-09", "2025-10", "2025-11"];

  it("URL の月がデータにあればその月", () => {
    expect(pickMonth("2025-09", months)).toBe("2025-09");
  });

  it("指定なし・形が不正・データのない月・複数指定は、最新の月（エラーにしない）", () => {
    expect(pickMonth(undefined, months)).toBe("2025-11");
    expect(pickMonth("2025-13", months)).toBe("2025-11");
    expect(pickMonth("abc", months)).toBe("2025-11");
    expect(pickMonth("2025-11<script>", months)).toBe("2025-11");
    expect(pickMonth("2024-01", months)).toBe("2025-11");
    expect(pickMonth(["2025-09", "2025-10"], months)).toBe("2025-11");
  });

  it("データが1件もなければ null", () => {
    expect(pickMonth("2025-09", [])).toBeNull();
  });
});

describe("表示期間（?period=）T-25", () => {
  it("month のときだけ「選択した月」。未指定・不正な値・配列は、安全な既定の「全期間」", () => {
    expect(pickPeriodKind("month")).toBe("month");
    expect(pickPeriodKind("all")).toBe("all");
    for (const bad of [undefined, "", "MONTH", "week", "month<script>", ["month", "all"]]) {
      expect(pickPeriodKind(bad)).toBe("all");
    }
  });

  it("集計に渡す期間：全期間 または 選んでいる月", () => {
    expect(toDisplayPeriod("all", "2025-11")).toEqual({ kind: "all" });
    expect(toDisplayPeriod("month", "2025-11")).toEqual({ kind: "month", month: "2025-11" });
  });

  it("URL は月と期間の両方を持つ（片方を変えても、もう片方が残る）", () => {
    expect(dashboardHref("2025-10", "month")).toBe("/?month=2025-10&period=month");
    expect(dashboardHref("2025-11", "all")).toBe("/?month=2025-11&period=all");
  });
});

describe("formatYen", () => {
  it("3桁区切りにする（単位は付けない）", () => {
    expect(formatYen(264700)).toBe("264,700");
    expect(formatYen(560600)).toBe("560,600");
    expect(formatYen(0)).toBe("0");
    expect(formatYen(999)).toBe("999");
  });
});

describe("formatManYen（グラフの軸・ラベル）T-23", () => {
  it("万円で小数第1位まで（四捨五入）・末尾の .0 は省く", () => {
    expect(formatManYen(147500)).toBe("14.8万");
    expect(formatManYen(264700)).toBe("26.5万");
    expect(formatManYen(92600)).toBe("9.3万");
    expect(formatManYen(50000)).toBe("5万");
    expect(formatManYen(0)).toBe("0万");
    expect(formatManYen(300000)).toBe("30万");
  });

  it("マイナスは符号つき。丸めて 0 になる小さな額は 0万（-0万にしない）", () => {
    expect(formatManYen(-12000)).toBe("-1.2万");
    expect(formatManYen(-400)).toBe("0万");
  });
});

describe("toTrendPoints（推移グラフの点）T-23", () => {
  const kpi = (month: string, revenue: number, grossProfit: number) => ({ month, revenue, grossProfit });

  it("集計の値をそのまま渡し、同じ年だけなら軸は「9月」", () => {
    const points = toTrendPoints([kpi("2025-09", 148400, 93400), kpi("2025-11", 264700, 163100)]);
    expect(points).toEqual([
      { month: "2025-09", label: "9月", revenue: 148400, grossProfit: 93400 },
      { month: "2025-11", label: "11月", revenue: 264700, grossProfit: 163100 },
    ]);
  });

  it("年をまたぐと、軸に年を入れる。0件なら空", () => {
    const points = toTrendPoints([kpi("2025-12", 1, 1), kpi("2026-01", 2, 2)]);
    expect(points.map((p) => p.label)).toEqual(["2025年12月", "2026年1月"]);
    expect(toTrendPoints([])).toEqual([]);
  });
});

describe("formatPercent / formatSignedPercent", () => {
  it("小数第1位まで。正解値：リピート率 46.7%・28.6%、売上の前月比 +79.5%", () => {
    expect(formatPercent({ numerator: 7, denominator: 15 })).toBe("46.7");
    expect(formatPercent({ numerator: 8, denominator: 28 })).toBe("28.6");
    expect(formatSignedPercent({ numerator: 264700 - 147500, denominator: 147500 })).toBe("+79.5");
  });

  it("減少は - 、0 は符号なしの 0.0", () => {
    expect(formatSignedPercent({ numerator: -1, denominator: 10 })).toBe("-10.0");
    expect(formatSignedPercent({ numerator: 0, denominator: 10 })).toBe("0.0");
  });

  it("計算できない（null）なら null（画面は「—」にする）", () => {
    expect(formatPercent(null)).toBeNull();
    expect(formatSignedPercent(null)).toBeNull();
  });
});
