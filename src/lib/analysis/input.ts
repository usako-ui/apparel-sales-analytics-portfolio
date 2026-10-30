// 集計 → AI に送る入力（T-31）。集計は lib/aggregate の関数をそのまま使う（ここで計算し直さない）
import {
  calcCategorySales,
  calcMonthlyKpis,
  calcMonthlyRepeat,
  calcRepeatOverall,
  calcSkuTop,
  type DisplayPeriod,
} from "@/lib/aggregate";
import type { SalesRow } from "@/lib/csv/validate";
import type { AnalysisInput } from "./prompt";

/**
 * カテゴリ別・SKU別の既定の期間：対象月（requirements 第7項「選んでいる月が対象」）。
 * 全期間に変える場合はここ1か所だけを直す
 */
export function defaultBreakdownPeriod(targetMonth: string): DisplayPeriod {
  return { kind: "month", month: targetMonth };
}

/** "2025-11" → "2025年11月"（文字列だけで作る。Date は使わない） */
export function formatMonthJa(month: string): string {
  const [year, mm] = month.split("-");
  return `${year}年${Number(mm)}月`;
}

/** 期間のラベル。対象月＝「2025年11月の集計」／全期間＝「全期間（2025年9月〜2025年11月）の集計」 */
export function periodLabelOf(period: DisplayPeriod, months: readonly string[]): string {
  if (period.kind === "month") return `${formatMonthJa(period.month)}の集計`;
  if (months.length === 0) return "全期間の集計";
  const sorted = [...months].sort();
  const first = formatMonthJa(sorted[0]);
  const last = formatMonthJa(sorted[sorted.length - 1]);
  return first === last ? `全期間（${first}）の集計` : `全期間（${first}〜${last}）の集計`;
}

/** 売上の行 → 送る入力。月別の KPI・リピート率は全月分、カテゴリ別・SKU別は period（既定は対象月） */
export function buildAnalysisInput(
  rows: readonly SalesRow[],
  targetMonth: string,
  period: DisplayPeriod = defaultBreakdownPeriod(targetMonth),
): AnalysisInput {
  const monthly = calcMonthlyKpis(rows);
  return {
    targetMonth,
    breakdownPeriodLabel: periodLabelOf(
      period,
      monthly.map((m) => m.month),
    ),
    monthly,
    repeat: calcMonthlyRepeat(rows),
    repeatOverall: calcRepeatOverall(rows),
    categories: calcCategorySales(rows, period),
    skus: calcSkuTop(rows, period),
  };
}
