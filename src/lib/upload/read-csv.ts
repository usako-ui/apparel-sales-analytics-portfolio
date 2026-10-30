// CSVファイルの確認 → 読み取り → 検査（パース）。本番の取り込み（import.ts）とデモ版が共有する
// Supabase・Next.js のサーバー専用機能に依存しない（ブラウザでも動く）
import { parseSalesCsv } from "@/lib/csv/parse";
import type { SalesRow, SkippedRow } from "@/lib/csv/validate";

/** ファイルサイズの上限（requirements.md 第20項：5MB） */
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** File のうち、この処理が使う部分だけ（テストで差し替えやすくする） */
export type UploadFile = {
  name: string;
  size: number;
  text(): Promise<string>;
};

/** 画面が使う失敗の戻り値。message は日本語（何が起きたか → どうすればよいか） */
export type UploadFailure = {
  ok: false;
  /** needsOverwrite：すでにある月があり、上書きの指定がない（画面は確認ダイアログを出す） */
  code: "needsOverwrite" | "error";
  message: string;
  /** code が needsOverwrite の時：上書きになる月（YYYY-MM・昇順） */
  overwriteMonths?: string[];
  /** 全行スキップで止めた時など：スキップ行のダウンロードに使う */
  skipped?: SkippedRow[];
};

/** 読み取りに成功した結果（成功行・スキップ行・対象月） */
export type Parsed = {
  rows: SalesRow[];
  skipped: SkippedRow[];
  months: string[];
};

export const fail = (message: string, extra: Partial<UploadFailure> = {}): UploadFailure => ({
  ok: false,
  code: "error",
  message,
  ...extra,
});

/** 共通：ファイルの確認 → 読み取り → パース。成功行が0件なら停止 */
export async function readAndParse(file: UploadFile | null): Promise<Parsed | UploadFailure> {
  if (!file || typeof file.size !== "number") {
    return fail("ファイルが選ばれていません。CSVファイルを選んでください");
  }
  // 5MB の確認は中身を読む前に行う（大きなファイルを処理しない）
  if (file.size > MAX_FILE_BYTES) {
    return fail("ファイルが大きすぎます（上限は5MBです）。月ごとなどに分けて、もう一度選んでください");
  }

  let text: string;
  try {
    text = await file.text();
  } catch {
    return fail("ファイルを読み取れませんでした。ファイルを選び直してください");
  }

  const parsed = parseSalesCsv(text);
  if (!parsed.ok) return fail(parsed.error);

  if (parsed.rows.length === 0) {
    return fail(
      "取り込める行がありませんでした。列名や日付・数値の形式を確認してください。スキップした行は一覧からダウンロードできます",
      { skipped: parsed.skipped },
    );
  }
  return { rows: parsed.rows, skipped: parsed.skipped, months: parsed.months };
}
