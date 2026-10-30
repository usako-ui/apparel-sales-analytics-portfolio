// CSV取り込みの本体（T-14）。Next.js に依存しない（クライアントを引数で受け取るので結合テストでも使える）
//   previewSalesCsv：確認（DBには書かない）。成功行・スキップ行・対象月と、すでにデータがある月を返す
//   importSalesCsv ：取り込み。ファイルをサーバーでパースし直し（ブラウザから届いた行データは信用しない）、
//                    DB関数 replace_month_uploads を本人の権限（RLS が効く）で1回だけ呼ぶ
// 使うキー：ログイン中の人の権限のクライアント（anon キー＋本人のセッション）。service role は使わない
// 二重計上の防止：DB の unique(shop_id, target_month) と、関数の1トランザクション（architecture.md 第4項）
import type { SupabaseClient } from "@supabase/supabase-js";
import { groupRowsByMonth, type SalesRow, type SkippedRow } from "@/lib/csv/validate";
import { fail, MAX_FILE_BYTES, readAndParse, type UploadFailure, type UploadFile } from "./read-csv";

// ファイルの確認・読み取り・パースは read-csv.ts（デモ版と共有）。既存の import 先を変えないよう再公開する
export { MAX_FILE_BYTES };
export type { UploadFailure, UploadFile };

export type PreviewResult =
  | {
      ok: true;
      fileName: string;
      successCount: number;
      skipped: SkippedRow[];
      /** 対象月（成功行に含まれる月・YYYY-MM・昇順） */
      months: string[];
      /** そのうち、すでにデータがある月＝上書きになる月（YYYY-MM・昇順） */
      overwriteMonths: string[];
    }
  | UploadFailure;

export type ImportResult =
  | {
      ok: true;
      fileName: string;
      successCount: number;
      skipped: SkippedRow[];
      months: string[];
      /** 実際に上書きした月（YYYY-MM・昇順） */
      overwriteMonths: string[];
    }
  | UploadFailure;

// すでにデータがある月（同じお店）。RLS が効くクライアントで読む＋shop_id でも絞る（二重防御）
async function findExistingMonths(
  db: SupabaseClient,
  shopId: string,
  months: string[],
): Promise<string[] | UploadFailure> {
  const { data, error } = await db
    .from("uploads")
    .select("target_month")
    .eq("shop_id", shopId)
    .in("target_month", months);
  if (error) {
    return fail("すでにあるデータの確認に失敗しました。時間をおいて、もう一度お試しください");
  }
  const existing = new Set((data ?? []).map((r) => String(r.target_month)));
  return months.filter((m) => existing.has(m));
}

/** 確認：DBには書かない */
export async function previewSalesCsv(
  db: SupabaseClient,
  shopId: string,
  file: UploadFile | null,
): Promise<PreviewResult> {
  const parsed = await readAndParse(file);
  if ("ok" in parsed) return parsed;

  const overwriteMonths = await findExistingMonths(db, shopId, parsed.months);
  if (!Array.isArray(overwriteMonths)) return overwriteMonths;

  return {
    ok: true,
    fileName: file!.name,
    successCount: parsed.rows.length,
    skipped: parsed.skipped,
    months: parsed.months,
    overwriteMonths,
  };
}

// DB関数に渡す形（列名は DB に合わせる）
function toDbRow(row: SalesRow) {
  return {
    order_date: row.orderDate,
    customer_id: row.customerId,
    product_name: row.productName,
    category: row.category,
    sku: row.sku,
    quantity: row.quantity,
    revenue: row.revenue,
    cost: row.cost,
  };
}

// DB のエラーを日本語にする。技術的な文・コードは画面に出さない
function messageForDbError(code: string | undefined): string {
  if (code === "42501") {
    return "取り込みの権限がありません。ログインし直しても解決しない場合は、管理者に連絡してください";
  }
  if (code === "23505") {
    return "同じ月の取り込みが同時に行われたため、取り込めませんでした。データは変更されていません。画面を開き直して、もう一度お試しください";
  }
  return "取り込みに失敗しました。データは変更されていません。時間をおいて、もう一度お試しください";
}

/**
 * 取り込み：ファイルをパースし直し、すでにある月があるのに overwrite が true でなければ拒否する。
 * 「上書きしない」場合はCSV全体を取り込まない（月ごとの部分取込はしない・requirements.md 第2項5）
 */
export async function importSalesCsv(
  db: SupabaseClient,
  shopId: string,
  file: UploadFile | null,
  overwrite: boolean,
): Promise<ImportResult> {
  const parsed = await readAndParse(file);
  if ("ok" in parsed) return parsed;

  const overwriteMonths = await findExistingMonths(db, shopId, parsed.months);
  if (!Array.isArray(overwriteMonths)) return overwriteMonths;

  if (overwriteMonths.length > 0 && !overwrite) {
    return {
      ok: false,
      code: "needsOverwrite",
      message: `${overwriteMonths.join("、")} のデータはすでにあります。上書きする場合は確認してからもう一度実行してください`,
      overwriteMonths,
    };
  }

  const payload = groupRowsByMonth(parsed.rows).map((g) => ({
    target_month: g.month,
    rows: g.rows.map(toDbRow),
  }));

  const { error } = await db.rpc("replace_month_uploads", {
    p_filename: file!.name,
    p_months: payload,
  });
  if (error) return fail(messageForDbError(error.code));

  return {
    ok: true,
    fileName: file!.name,
    successCount: parsed.rows.length,
    skipped: parsed.skipped,
    months: parsed.months,
    overwriteMonths,
  };
}
