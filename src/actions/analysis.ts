"use server";

// AI分析の Server Action（ダッシュボードの「分析を生成」ボタンから呼ぶ）
// 最初に requireMember()：ログイン中・有効・パスワード変更済み・同じお店（管理者・操作者のどちらも生成できる：requirements 第3項）
// 使うキー：ログイン中の人の権限のクライアント（RLS が効く）。service role は使わない
// LLM のキー（ANTHROPIC_API_KEY・GEMINI_API_KEY）は lib/llm の中だけで読む。ここでは扱わない
// 同時に2回押されても、行が2つ増えるだけで壊れない（表示は generated_at が最新の1行）
import { revalidatePath } from "next/cache";
import { generateMonthAnalysis, type GenerateMonthResult } from "@/lib/analysis/generate-month";
import { requireMember } from "@/lib/auth/guard";
import { generateJson } from "@/lib/llm";

export async function generateAnalysisAction(month: string): Promise<GenerateMonthResult> {
  const member = await requireMember();
  const result = await generateMonthAnalysis(member.supabase, member, month, generateJson);
  if (result.ok) revalidatePath("/");
  return result;
}
