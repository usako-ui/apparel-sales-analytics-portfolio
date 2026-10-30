// 管理者画面の入力の検証（Zod）。メッセージは「何が起きたか → どうすればよいか」
import { z } from "zod";

const displayName = z
  .string({ error: "名前を入力してください。" })
  .trim()
  .min(1, { error: "名前を入力してください。" })
  .max(50, { error: "名前は50文字以内で入力してください。" });

// メールアドレスは小文字にそろえる（Supabase Auth も小文字で扱うため、重複の判定がずれない）
const email = z
  .string({ error: "メールアドレスを入力してください。" })
  .trim()
  .min(1, { error: "メールアドレスを入力してください。" })
  .max(254, { error: "メールアドレスが長すぎます。254文字以内で入力してください。" })
  .toLowerCase()
  .pipe(z.email({ error: "メールアドレスの形式が正しくありません。確認してから、もう一度入力してください。" }));

const role = z.enum(["admin", "operator"], { error: "ロールは「管理者」か「操作者」を選んでください。" });
const status = z.enum(["active", "leave", "retired"], { error: "状態は「有効」「休職」「退職」から選んでください。" });
const targetId = z.uuid({ error: "対象のメンバーを選び直してください。" });

export const createMemberSchema = z.object({ displayName, email, role });
export const reissueSchema = z.object({ targetId });
export const changeStatusSchema = z.object({ targetId, status });
export const changeRoleSchema = z.object({ targetId, role });
export const editMemberSchema = z
  .object({ targetId, displayName: displayName.optional(), email: email.optional() })
  .refine((v) => v.displayName !== undefined || v.email !== undefined, {
    error: "名前かメールアドレスのどちらかを入力してください。",
  });

// 検証に失敗したときの最初のメッセージ
export function firstIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "入力内容を確認してください。";
}
