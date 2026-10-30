// AI分析の保存（T-31）。reports に1行追加する。RLS が効く（ログイン中の本人の権限）クライアントを使う
// 呼び出し口（Server Action・Day8）が先に requireMember() を通し、その Member の shopId・userId を渡す
// 保存は RLS でも「同じお店の uploads に結ぶ行だけ」に制限されている（二重防御）
import type { SupabaseClient } from "@supabase/supabase-js";
import type { GenerateAnalysisResult } from "./run";

export type SaveReportResult = { ok: true; reportId: string } | { ok: false; message: string };

const SAVE_FAILURE = "分析結果を保存できませんでした。時間をおいて、もう一度生成してください。";
const NO_UPLOAD = "この月の売上データが見つかりません。月を選び直してください。";

type Generated = Extract<GenerateAnalysisResult, { ok: true }>;

export async function saveReport(
  db: SupabaseClient,
  member: { shopId: string; userId: string },
  targetMonth: string,
  generated: Generated,
): Promise<SaveReportResult> {
  // 対象月の uploads（お店と月の組み合わせは一意）
  const { data: uploads, error: uploadError } = await db
    .from("uploads")
    .select("id")
    .eq("shop_id", member.shopId)
    .eq("target_month", targetMonth)
    .limit(1);
  if (uploadError) return { ok: false, message: SAVE_FAILURE };
  const uploadId = uploads?.[0]?.id;
  if (typeof uploadId !== "string") return { ok: false, message: NO_UPLOAD };

  const { data, error } = await db
    .from("reports")
    .insert({
      upload_id: uploadId,
      shop_id: member.shopId,
      target_month: targetMonth,
      result: generated.report,
      llm_provider: generated.provider,
      has_number_warning: generated.hasNumberWarning,
      input_tokens: generated.usage.inputTokens,
      output_tokens: generated.usage.outputTokens,
      generated_by: member.userId,
    })
    .select("id")
    .single();
  if (error || typeof data?.id !== "string") return { ok: false, message: SAVE_FAILURE };
  return { ok: true, reportId: data.id };
}
