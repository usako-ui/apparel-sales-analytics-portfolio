import { ALL_PERIOD, isValidMonth, type DisplayPeriod } from "@/lib/aggregate";

/** カテゴリ別・売れ筋の表示期間の種類（URL の ?period=）。KPI・推移グラフは月単位なので影響しない */
export type PeriodKind = "all" | "month";

/** ?period= の値から種類を決める。"month" 以外（未指定・不正・配列）はすべて「全期間」 */
export function pickPeriodKind(requested: string | string[] | undefined): PeriodKind {
  return requested === "month" ? "month" : "all";
}

/** 種類と、選んでいる月から、集計に渡す表示期間にする */
export function toDisplayPeriod(kind: PeriodKind, month: string): DisplayPeriod {
  return kind === "month" ? { kind: "month", month } : ALL_PERIOD;
}

/**
 * ダッシュボードの URL。月と期間の種類を両方持つ（月を変えても期間の選択を残し、期間を変えても月を残す）。
 * basePath は画面の置き場所（本番は "/"、デモ版は "/demo"）
 */
export function dashboardHref(month: string, period: PeriodKind, basePath = "/"): string {
  return `${basePath}?month=${encodeURIComponent(month)}&period=${period}`;
}

/**
 * URL の ?month= から、表示する月を決める。
 * 形が不正（YYYY-MM でない・配列など）、またはデータのない月は、最新の月にする（エラーにはしない）。
 * available は月の昇順（calcMonthlyKpis の並び）。空なら null
 */
export function pickMonth(requested: string | string[] | undefined, available: readonly string[]): string | null {
  const latest = available.at(-1) ?? null;
  if (typeof requested !== "string" || !isValidMonth(requested)) return latest;
  return available.includes(requested) ? requested : latest;
}
