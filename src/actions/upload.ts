"use server";

// CSVアップロードの Server Action（画面 /upload から呼ぶ）。すべて最初に requireMember() を呼ぶ
//   （ログイン中・有効・パスワード変更済み・同じお店）
// 使うキー：ログイン中の人の権限のクライアント（RLS が効く）。service role は使わない
// 入力は FormData：file（CSVファイル）／overwrite（"true" のときだけ上書きを許可）
// 戻り値の型と message（日本語）は lib/upload/import.ts。技術的なエラー文は画面に渡さない
import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/guard";
import {
  type ImportResult,
  type PreviewResult,
  type UploadFile,
  importSalesCsv,
  previewSalesCsv,
} from "@/lib/upload/import";

function pickFile(formData: FormData): UploadFile | null {
  const value = formData.get("file");
  return value instanceof File ? value : null;
}

/** 確認（DBには書かない）：成功行・スキップ行・対象月・上書きになる月を返す */
export async function previewUpload(formData: FormData): Promise<PreviewResult> {
  const member = await requireMember();
  return previewSalesCsv(member.supabase, member.shopId, pickFile(formData));
}

/** 取り込み：サーバーでパースし直す。上書きになる月があるのに overwrite が "true" でなければ拒否 */
export async function importUpload(formData: FormData): Promise<ImportResult> {
  const member = await requireMember();
  const overwrite = formData.get("overwrite") === "true";
  const result = await importSalesCsv(member.supabase, member.shopId, pickFile(formData), overwrite);
  if (result.ok) revalidatePath("/");
  return result;
}
