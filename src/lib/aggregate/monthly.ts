// 月別の売上・粗利・前月比（T-16）。入力は行の配列だけ（DB・CSV どちらから来ても同じ）

import type { SalesRow } from "@/lib/csv/validate";
import { monthOf, previousMonth } from "./month";
import { makeChange, type Change } from "./ratio";

export type MonthlyKpi = {
  month: string; // YYYY-MM
  revenue: number; // 円（整数）
  grossProfit: number; // 円（整数）= revenue − cost
  /** 売上の前月比。前月のデータなし・前月が0以下なら ratio が null（画面で「—」）で、reason に理由 */
  revenueChange: Change;
  /** 粗利の前月比。同上 */
  grossProfitChange: Change;
};

/** データのある月ごとの売上・粗利・前月比。月の昇順 */
export function calcMonthlyKpis(rows: readonly SalesRow[]): MonthlyKpi[] {
  const totals = new Map<string, { revenue: number; grossProfit: number }>();
  for (const row of rows) {
    const month = monthOf(row.orderDate);
    const t = totals.get(month) ?? { revenue: 0, grossProfit: 0 };
    t.revenue += row.revenue;
    t.grossProfit += row.revenue - row.cost;
    totals.set(month, t);
  }

  return [...totals.keys()].sort().map((month) => {
    const current = totals.get(month)!;
    const prevKey = previousMonth(month);
    const prev = prevKey === null ? undefined : totals.get(prevKey);
    return {
      month,
      revenue: current.revenue,
      grossProfit: current.grossProfit,
      revenueChange: makeChange(current.revenue, prev?.revenue),
      grossProfitChange: makeChange(current.grossProfit, prev?.grossProfit),
    };
  });
}
