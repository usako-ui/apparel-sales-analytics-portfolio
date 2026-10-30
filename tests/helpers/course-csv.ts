// 講座の配布 CSV（tests/fixtures/sample-sales.csv）の有無を調べる補助。
// 公開用リポジトリには配布 CSV を入れないため、このファイルを読むテストは「ファイルがない時だけ」飛ばす。
// 作業用リポジトリには配布 CSV があるので、ここでは全部実行される。
import { existsSync } from "node:fs";
import path from "node:path";

export const courseCsvPath = path.resolve(__dirname, "../fixtures/sample-sales.csv");

export const hasCourseCsv = existsSync(courseCsvPath);

export const courseCsvSkipReason = "講座の配布 CSV がないため省略";

// 単体テスト（vitest）で、ファイルがない時に理由を1回だけ出す（import した時）
if (!hasCourseCsv && process.env.VITEST) {
  console.info(courseCsvSkipReason);
}
