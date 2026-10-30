// AI分析コメントの出力の型（T-31・requirements 第7項）。AI の応答はこのスキーマで検証してから保存する
import { z } from "zod";

export const analysisResultSchema = z.object({
  summary: z.string().trim().min(1).max(200),
  highlights: z.array(z.string().trim().min(1)).length(3),
  concerns: z.array(z.string().trim().min(1)).length(2),
  actions: z
    .array(
      z.object({
        priority: z.enum(["high", "medium", "low"]),
        action: z.string().trim().min(1),
      }),
    )
    .min(1),
});
export type AnalysisResult = z.infer<typeof analysisResultSchema>;

/** 数字の照合で一致しなかった数値（T-32） */
export const numberWarningSchema = z.object({
  kind: z.enum(["amount", "percent"]),
  /** AI の文に書かれていた表記（例：約30万円） */
  text: z.string(),
  /** どの項目か（summary・highlights[0]・concerns[1]・actions[0] など） */
  field: z.string(),
});
export type NumberWarning = z.infer<typeof numberWarningSchema>;

/** reports.result（JSONB）に入れる形：コメント＋数字の照合で出た警告の一覧 */
export const storedReportSchema = analysisResultSchema.extend({
  numberWarnings: z.array(numberWarningSchema),
});
export type StoredReport = z.infer<typeof storedReportSchema>;
