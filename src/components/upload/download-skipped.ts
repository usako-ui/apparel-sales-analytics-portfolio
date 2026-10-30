// スキップ行のCSVをブラウザで作って保存する（サーバーには送らない）
import { buildSkippedRowsCsv, type SkippedRow } from "@/lib/csv/validate";

/** 保存するファイル名。例：sample-sales.csv → sample-sales_スキップ行.csv（ファイル名に使えない文字は除く） */
export function skippedFileName(sourceName: string): string {
  const base = sourceName.replace(/\.csv$/i, "").replace(/[\\/:*?"<>|]/g, "").trim() || "売上";
  return `${base}_スキップ行.csv`;
}

export function downloadSkippedRows(skipped: readonly SkippedRow[], sourceName: string): void {
  // buildSkippedRowsCsv の先頭には BOM が付いている（Excel で文字化けしないため）
  const blob = new Blob([buildSkippedRowsCsv(skipped)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = skippedFileName(sourceName);
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
