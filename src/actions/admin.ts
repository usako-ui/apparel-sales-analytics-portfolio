"use server";

// 管理者画面の Server Action。すべて最初に requireAdmin()（ログイン中・有効・パスワード変更済み・管理者）を呼ぶ
// 処理の本体は lib/admin/members.ts（そこで「対象の人が同じお店か」も確かめる）
// 使うキー：service role（絶対に隠すキー）。サーバー側だけ。ブラウザには渡らない
// 戻り値の temporaryPassword は、画面に1回だけ表示するためのもの。保存・ログ出力しない
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guard";
import {
  type Actor,
  type ActionResult,
  type PasswordResult,
  type StatusResult,
  changeRole as changeRoleImpl,
  changeStatus as changeStatusImpl,
  createMember as createMemberImpl,
  editMember as editMemberImpl,
  reissuePassword as reissuePasswordImpl,
} from "@/lib/admin/members";
import { createAdminClient } from "@/lib/supabase/admin";

async function context() {
  const admin = await requireAdmin();
  const actor: Actor = { userId: admin.userId, shopId: admin.shopId };
  return { actor, db: createAdminClient() };
}

function refresh<T extends { ok: boolean }>(result: T): T {
  if (result.ok) revalidatePath("/admin");
  return result;
}

// 入力：{ displayName, email, role }
export async function createMember(input: unknown): Promise<PasswordResult> {
  const { actor, db } = await context();
  return refresh(await createMemberImpl(db, actor, input));
}

// 入力：{ targetId }
export async function reissuePassword(input: unknown): Promise<PasswordResult> {
  const { actor, db } = await context();
  return refresh(await reissuePasswordImpl(db, actor, input));
}

// 入力：{ targetId, status }
export async function changeStatus(input: unknown): Promise<StatusResult> {
  const { actor, db } = await context();
  return refresh(await changeStatusImpl(db, actor, input));
}

// 入力：{ targetId, role }
export async function changeRole(input: unknown): Promise<ActionResult<{ userId: string }>> {
  const { actor, db } = await context();
  return refresh(await changeRoleImpl(db, actor, input));
}

// 入力：{ targetId, displayName?, email? }
export async function editMember(input: unknown): Promise<ActionResult<{ userId: string }>> {
  const { actor, db } = await context();
  return refresh(await editMemberImpl(db, actor, input));
}
