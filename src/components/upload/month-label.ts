// 対象月の表示用の文字（"2025-11" → "2025年11月"）。形が違う値はそのまま返す
export function formatMonthLabel(month: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return month;
  return `${match[1]}年${Number(match[2])}月`;
}

export function formatMonthList(months: readonly string[]): string {
  return months.map(formatMonthLabel).join("、");
}
