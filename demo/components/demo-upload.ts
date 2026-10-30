// デモ版のCSV「確認」「取り込み」（ブラウザ内）。本番の Server Action と同じ形の関数を作る
// - 読み取りと検査は本番と共有（readAndParse）。違うのは保存先だけ（Supabase → ブラウザ内のストア）
// - 本番と同じく、取り込みでもファイルを読み直す（確認の結果を信用しない）
// - 上書きになる月があるのに overwrite が "true" でなければ取り込まない（本番と同じ流れ）
import { formatMonthList } from "@/components/upload/month-label";
import type { ImportResult, PreviewResult } from "@/lib/upload/import";
import { readAndParse, type UploadFile } from "@/lib/upload/read-csv";
import type { DemoStore } from "../lib/store";

export type DemoUploadActions = {
  preview: (formData: FormData) => Promise<PreviewResult>;
  import: (formData: FormData) => Promise<ImportResult>;
};

function pickFile(formData: FormData): UploadFile | null {
  const value = formData.get("file");
  return value instanceof File ? value : null;
}

/** 保存されている月のうち、取り込む月と重なるもの（昇順） */
function overlappingMonths(store: DemoStore, months: readonly string[]): string[] {
  const existing = new Set(store.existingMonths());
  return months.filter((m) => existing.has(m));
}

/**
 * store を使う「確認」「取り込み」を作る。
 * onSaved は取り込みが済んだ直後に呼ぶ（画面が保存データを読み直すため。persisted は保存できたか）
 */
export function createDemoUploadActions(store: DemoStore, onSaved: (persisted: boolean) => void): DemoUploadActions {
  return {
    async preview(formData) {
      const file = pickFile(formData);
      const parsed = await readAndParse(file);
      if ("ok" in parsed) return parsed;
      return {
        ok: true,
        fileName: file!.name,
        successCount: parsed.rows.length,
        skipped: parsed.skipped,
        months: parsed.months,
        overwriteMonths: overlappingMonths(store, parsed.months),
      };
    },

    async import(formData) {
      const file = pickFile(formData);
      const overwrite = formData.get("overwrite") === "true";
      const parsed = await readAndParse(file);
      if ("ok" in parsed) return parsed;

      const overwriteMonths = overlappingMonths(store, parsed.months);
      if (overwriteMonths.length > 0 && !overwrite) {
        return {
          ok: false,
          code: "needsOverwrite",
          message: `${formatMonthList(overwriteMonths)} のデータはすでにあります。上書きする場合は確認してからもう一度実行してください`,
          overwriteMonths,
        };
      }

      const { persisted } = store.replaceMonths(parsed.rows);
      onSaved(persisted);
      return {
        ok: true,
        fileName: file!.name,
        successCount: parsed.rows.length,
        skipped: parsed.skipped,
        months: parsed.months,
        overwriteMonths,
      };
    },
  };
}

/** 同梱のダミーCSVの置き場所と、画面に出すファイル名 */
export const SAMPLE_CSV_PATH = "/sample-sales-demo.csv";
export const SAMPLE_CSV_NAME = "sample-sales-demo.csv";

export const SAMPLE_FETCH_ERROR = "ダミーCSVを読み込めませんでした。通信を確かめてから、もう一度お試しください。";

/** ダミーCSVを取得して File にする。失敗したら null */
export async function fetchSampleCsv(fetcher: typeof fetch = fetch): Promise<File | null> {
  try {
    const response = await fetcher(SAMPLE_CSV_PATH, { cache: "no-store" });
    if (!response.ok) return null;
    const text = await response.text();
    return new File([text], SAMPLE_CSV_NAME, { type: "text/csv" });
  } catch {
    return null;
  }
}
