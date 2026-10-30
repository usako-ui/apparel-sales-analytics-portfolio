// リピート率（T-17）。customer_id が空欄の行は除外する
// 月ごとの定義は【案】（クライアント確認待ち）。変わったら calcMonthlyRepeat の中だけ差し替える

import type { SalesRow } from "@/lib/csv/validate";
import { monthOf, previousMonth } from "./month";
import { makeRatio, unavailable, type Change, type Ratio } from "./ratio";

/** リピート率（repeaters ÷ total）。total が 0 なら理由つきで計算しない */
function makeRate(repeaters: number, total: number): Change {
  const ratio = makeRatio(repeaters, total);
  return ratio === null ? unavailable("noCustomerId") : { ratio, reason: null };
}

export type RepeatOverall = {
  repeaters: number; // 2か月以上にわたって購入した顧客数
  customers: number; // 全顧客数（customer_id あり）
  /** repeaters ÷ customers。顧客が0人なら ratio が null・reason が noCustomerId */
  rate: Change;
};

export type MonthlyRepeat = {
  month: string; // YYYY-MM
  repeaters: number; // その月の購入者のうち、それより前の月に購入がある人
  buyers: number; // その月の購入者（customer_id あり）
  /** repeaters ÷ buyers。購入者が0人なら ratio が null・reason が noCustomerId */
  rate: Change;
  /**
   * 前月との差（ポイント）。割合の差を Ratio で持つ（roundPercent で pt の値になる）。
   * 前月のデータなし・前月の購入者が0人・当月の購入者が0人なら ratio が null（画面で「—」）で、reason に理由
   */
  changePoints: Change;
};

/** 顧客ごとの購入月の集合（customer_id 空欄は除外） */
function monthsByCustomer(rows: readonly SalesRow[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const row of rows) {
    if (row.customerId === null || row.customerId === "") continue;
    const set = map.get(row.customerId) ?? new Set<string>();
    set.add(monthOf(row.orderDate));
    map.set(row.customerId, set);
  }
  return map;
}

/** 期間全体：2か月以上にわたって購入した顧客数 ÷ 全顧客数 */
export function calcRepeatOverall(rows: readonly SalesRow[]): RepeatOverall {
  const byCustomer = monthsByCustomer(rows);
  let repeaters = 0;
  for (const months of byCustomer.values()) {
    if (months.size >= 2) repeaters++;
  }
  const customers = byCustomer.size;
  return { repeaters, customers, rate: makeRate(repeaters, customers) };
}

/** 2つの割合の差（a − b）。分母が正の割合どうしなので、通分した分数で持つ */
function differenceOf(a: Ratio, b: Ratio): Ratio {
  return {
    numerator: a.numerator * b.denominator - b.numerator * a.denominator,
    denominator: a.denominator * b.denominator,
  };
}

/**
 * 月ごと【案】：その月の購入者のうち、それより前の月（お店の全データ）に購入がある人の割合。
 * データのある月ごと・月の昇順
 */
export function calcMonthlyRepeat(rows: readonly SalesRow[]): MonthlyRepeat[] {
  const byCustomer = monthsByCustomer(rows);
  const months = [...new Set(rows.map((r) => monthOf(r.orderDate)))].sort();

  const base = months.map((month) => {
    let buyers = 0;
    let repeaters = 0;
    for (const purchased of byCustomer.values()) {
      if (!purchased.has(month)) continue;
      buyers++;
      if ([...purchased].some((m) => m < month)) repeaters++;
    }
    return { month, repeaters, buyers, rate: makeRate(repeaters, buyers) };
  });

  const byMonth = new Map(base.map((b) => [b.month, b]));
  return base.map((b) => {
    const prevKey = previousMonth(b.month);
    const prev = prevKey === null ? undefined : byMonth.get(prevKey);
    let changePoints: Change;
    if (prev === undefined) changePoints = unavailable("noPreviousMonth");
    else if (prev.rate.ratio === null) changePoints = unavailable("noPreviousBuyers");
    else if (b.rate.ratio === null) changePoints = unavailable("noBuyers");
    else changePoints = { ratio: differenceOf(b.rate.ratio, prev.rate.ratio), reason: null };
    return { ...b, changePoints };
  });
}
