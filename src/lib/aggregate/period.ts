// 表示期間（カテゴリ別売上・SKUトップ10 で共通）。KPI・推移グラフは月単位なのでここは使わない

import type { SalesRow } from "@/lib/csv/validate";
import { isValidMonth, monthOf } from "./month";

/** 全期間、または選択した月（YYYY-MM） */
export type DisplayPeriod = { kind: "all" } | { kind: "month"; month: string };

export const ALL_PERIOD: DisplayPeriod = { kind: "all" };

/** 表示期間に入る行だけを返す。存在しない月・不正な月（YYYY-MM でない）なら空の配列 */
export function rowsInPeriod(rows: readonly SalesRow[], period: DisplayPeriod): SalesRow[] {
  if (period.kind === "all") return [...rows];
  if (!isValidMonth(period.month)) return [];
  return rows.filter((r) => monthOf(r.orderDate) === period.month);
}

/** 文字列の並び替え用（ロケールに依存しない比較。0 を返すのは同じ文字列のときだけ） */
export function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
