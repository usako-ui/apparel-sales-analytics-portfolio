// 最新のAI分析の読み込み（Day8）。ダッシュボード（page.tsx）から呼ぶ
// ログイン中の人の権限のクライアント（RLS が効く）を使う。他のお店の分析は読めない
import type { SupabaseClient } from "@supabase/supabase-js";
import { storedReportSchema, type StoredReport } from "./schema";

export type LatestReport = {
  id: string;
  report: StoredReport;
  /** ISO 形式の日時（表示は画面側で整える） */
  generatedAt: string;
  provider: "claude" | "gemini";
  /** 数字の照合で一致しない数値があった（report.numberWarnings が1件以上） */
  hasNumberWarning: boolean;
};

/**
 * 同じお店・同じ月の、generated_at が最新の1行。
 * 読み込みに失敗した・壊れた result（型に合わない）は null（＝「まだありません」）として扱い、画面を壊さない
 */
export async function loadLatestReport(
  db: SupabaseClient,
  shopId: string,
  month: string,
): Promise<LatestReport | null> {
  const { data, error } = await db
    .from("reports")
    .select("id, result, llm_provider, generated_at")
    .eq("shop_id", shopId)
    .eq("target_month", month)
    .order("generated_at", { ascending: false })
    .order("id", { ascending: false }) // 同じ時刻なら id の大きい方（順序を固定する）
    .limit(1);
  if (error) return null;

  const row = data?.[0] as
    | { id?: unknown; result?: unknown; llm_provider?: unknown; generated_at?: unknown }
    | undefined;
  if (!row) return null;

  const parsed = storedReportSchema.safeParse(row.result);
  if (!parsed.success) return null;
  if (typeof row.id !== "string" || typeof row.generated_at !== "string") return null;
  if (row.llm_provider !== "claude" && row.llm_provider !== "gemini") return null;

  return {
    id: row.id,
    report: parsed.data,
    generatedAt: row.generated_at,
    provider: row.llm_provider,
    hasNumberWarning: parsed.data.numberWarnings.length > 0,
  };
}
