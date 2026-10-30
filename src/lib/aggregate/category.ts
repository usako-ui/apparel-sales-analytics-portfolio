// カテゴリ別売上（T-18）。入力は行の配列だけ

import type { SalesRow } from "@/lib/csv/validate";
import { compareText, rowsInPeriod, type DisplayPeriod } from "./period";

export type CategorySales = {
  category: string;
  revenue: number; // 円（整数）
};

/** 表示期間のカテゴリごとの売上合計。売上の多い順、同額ならカテゴリ名の文字順 */
export function calcCategorySales(rows: readonly SalesRow[], period: DisplayPeriod): CategorySales[] {
  const totals = new Map<string, number>();
  for (const row of rowsInPeriod(rows, period)) {
    totals.set(row.category, (totals.get(row.category) ?? 0) + row.revenue);
  }
  return [...totals.entries()]
    .map(([category, revenue]) => ({ category, revenue }))
    .sort((a, b) => b.revenue - a.revenue || compareText(a.category, b.category));
}
