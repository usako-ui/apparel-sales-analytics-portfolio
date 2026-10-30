// 月（YYYY-MM）の文字列の操作。new Date() は使わない（タイムゾーンのずれを避ける）

/** 行の order_date（YYYY-MM-DD）から対象月（YYYY-MM）を取り出す */
export function monthOf(orderDate: string): string {
  return orderDate.slice(0, 7);
}

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** YYYY-MM の形（月は 01〜12）か */
export function isValidMonth(month: string): boolean {
  return MONTH_PATTERN.test(month);
}

/** 暦の前月。2025-11 → 2025-10、2025-01 → 2024-12。不正な月は null */
export function previousMonth(month: string): string | null {
  if (!isValidMonth(month)) return null;
  const year = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  if (m === 1) return `${String(year - 1).padStart(4, "0")}-12`;
  return `${month.slice(0, 4)}-${String(m - 1).padStart(2, "0")}`;
}
