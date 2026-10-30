import type { MonthlyKpi } from "@/lib/aggregate";

/** 推移グラフの1点（1か月分）。値は集計の結果をそのまま渡す（ここでは計算しない） */
export type TrendPoint = {
  month: string; // YYYY-MM
  label: string; // 軸の文字（同じ年だけなら「9月」、年をまたぐなら「2025年9月」）
  revenue: number; // 円
  grossProfit: number; // 円
};

const yearOf = (month: string) => month.slice(0, 4);
const monthNumber = (month: string) => Number(month.slice(5, 7));

/** calcMonthlyKpis の結果（月の昇順）を、グラフの点の並びにする */
export function toTrendPoints(kpis: readonly Pick<MonthlyKpi, "month" | "revenue" | "grossProfit">[]): TrendPoint[] {
  const crossesYears = new Set(kpis.map((k) => yearOf(k.month))).size > 1;
  return kpis.map((k) => ({
    month: k.month,
    label: crossesYears ? `${yearOf(k.month)}年${monthNumber(k.month)}月` : `${monthNumber(k.month)}月`,
    revenue: k.revenue,
    grossProfit: k.grossProfit,
  }));
}
