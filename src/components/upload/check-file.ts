// 選んだファイルを、サーバーへ送る前に確認する（画面側の確認）
// サーバー側でも同じ上限を確認している（lib/upload/import.ts）。ここで止めるのは、
// 6MB を超えると Next.js 側のエラーになり、日本語のメッセージを返せないため
import { MAX_FILE_BYTES } from "@/lib/upload/read-csv";

// サーバー側（import.ts）と同じ趣旨の文
export const FILE_TOO_LARGE_MESSAGE =
  "ファイルが大きすぎます（上限は5MBです）。月ごとなどに分けて、もう一度選んでください";
export const NOT_CSV_MESSAGE =
  "CSVファイル（.csv）を選んでください。Excel のファイルは、CSV 形式で保存し直してから選んでください";
export const TOO_MANY_FILES_MESSAGE = "ファイルは1つだけ選んでください。複数ある場合は、1つずつ取り込んでください";

/** 問題がなければ null、あれば画面に出す日本語の文 */
export function checkSelectedFile(file: { name: string; size: number }): string | null {
  if (!/\.csv$/i.test(file.name)) return NOT_CSV_MESSAGE;
  if (file.size > MAX_FILE_BYTES) return FILE_TOO_LARGE_MESSAGE;
  return null;
}
