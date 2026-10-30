// 月を指定してAI分析を生成・保存する一連の流れ（Server Action から呼ぶ。Next.js に依存しない）
// 流れ（requirements 第7項）：月の確認 → 売上の読み込み → 集計 → 生成（検証・再試行・数字の照合）→ 保存
// 認可（ログイン・有効・パスワード変更済み・お店）は呼び出し側が requireMember() で済ませてから、その結果を渡す
import type { SupabaseClient } from "@supabase/supabase-js";
import { isValidMonth, loadSalesRows, monthOf } from "@/lib/aggregate";
import type { GenerateJson } from "@/lib/llm/types";
import { buildAnalysisInput } from "./input";
import { generateAnalysis } from "./run";
import { saveReport } from "./save";
import type { StoredReport } from "./schema";

export type GenerateMonthResult =
  | {
      ok: true;
      reportId: string;
      report: StoredReport;
      hasNumberWarning: boolean;
      provider: "claude" | "gemini";
    }
  | { ok: false; message: string };

const INVALID_MONTH = "月の指定が正しくありません。月を選び直してください。";
const NO_DATA = "この月の売上データが見つかりません。月を選び直してください。";
const UNEXPECTED = "AI分析を生成できませんでした。時間をおいて、もう一度生成してください。";

export async function generateMonthAnalysis(
  db: SupabaseClient,
  member: { shopId: string; userId: string },
  month: string,
  generate: GenerateJson,
): Promise<GenerateMonthResult> {
  if (typeof month !== "string" || !isValidMonth(month)) return { ok: false, message: INVALID_MONTH };

  try {
    const loaded = await loadSalesRows(db, member.shopId);
    if (!loaded.ok) return { ok: false, message: loaded.error };
    if (!loaded.rows.some((r) => monthOf(r.orderDate) === month)) return { ok: false, message: NO_DATA };

    const generated = await generateAnalysis(buildAnalysisInput(loaded.rows, month), generate);
    if (!generated.ok) {
      // 運用の確認用ログ：理由コード・試行回数・トークン数だけ（キー・AI の応答・売上の中身は出さない）
      console.error("[analysis] 生成に失敗", {
        reason: generated.reason,
        attempts: generated.attempts,
        usage: generated.usage,
      });
      return { ok: false, message: generated.message };
    }

    const saved = await saveReport(db, member, month, generated);
    if (!saved.ok) return { ok: false, message: saved.message };

    return {
      ok: true,
      reportId: saved.reportId,
      report: generated.report,
      hasNumberWarning: generated.hasNumberWarning,
      provider: generated.provider,
    };
  } catch (error) {
    // 想定外の例外：メッセージには外部サービスの情報が混ざりうるため、名前だけをログに残す
    console.error("[analysis] 想定外のエラー", { name: error instanceof Error ? error.name : "unknown" });
    return { ok: false, message: UNEXPECTED };
  }
}
