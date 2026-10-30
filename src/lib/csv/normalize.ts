// 日付の正規化。new Date() は使わない（タイムゾーンでずれるため）。文字列と数値だけで判定する

const DATE_PATTERN = /^(\d{4})([-/])(\d{1,2})\2(\d{1,2})(?:[ T]\d.*)?$/;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/**
 * `YYYY-MM-DD`／`YYYY/MM/DD`（月日1桁可・後ろの時刻は無視）を `YYYY-MM-DD` にする。
 * 読めない・実在しない日付は null。
 */
export function normalizeDate(raw: string): string | null {
  const match = DATE_PATTERN.exec(raw.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[3]);
  const day = Number(match[4]);
  if (year < 1 || month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${match[1]}-${mm}-${dd}`;
}
