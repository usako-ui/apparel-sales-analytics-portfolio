// 管理者画面の処理の本体（メンバーの追加・再発行・状態の変更・ロールの変更・編集）
// - db は service role のクライアントを受け取る（RLS を通らない）。呼ぶのは src/actions/admin.ts だけ
//   （requireAdmin() の後）。Next.js に依存しないので、結合テストから直接呼べる
// - service role は RLS を通らないため、ここで必ず「操作する人が同じお店の有効な管理者か」
//   「対象の人が同じお店か」を確かめる（二重防御）
// - 一時パスワードは戻り値で1回だけ返す。DB・admin_logs・console・エラーには入れない
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import {
  changeRoleSchema,
  changeStatusSchema,
  createMemberSchema,
  editMemberSchema,
  firstIssueMessage,
  reissueSchema,
} from "./schemas";
import { generateTemporaryPassword } from "./temp-password";

export type Actor = { userId: string; shopId: string };
type Role = "admin" | "operator";
type Status = "active" | "leave" | "retired";

// warning：操作は成功したが記録（admin_logs）に失敗したときの知らせ
export type ActionResult<T extends object = object> =
  | ({ ok: true; warning?: string } & T)
  | { ok: false; error: string };

export type PasswordResult = ActionResult<{ userId: string; temporaryPassword: string }>;

type TargetRow = { user_id: string; shop_id: string; display_name: string; role: Role; status: Status };

const MSG = {
  notAdmin: "この操作は、有効な管理者だけが行えます。管理者に連絡してください。",
  notFound: "対象のメンバーが見つかりません。画面を開き直してから、もう一度お試しください。",
  selfStatus: "自分自身の状態は変更できません。ほかの管理者に依頼してください。",
  selfReissue:
    "自分自身の一時パスワードは再発行できません。自分のパスワードは、メニューの「パスワード変更」から変更してください。",
  selfRole: "自分自身のロールは変更できません。ほかの管理者に依頼してください。",
  lastAdmin:
    "有効な管理者が0人になる変更はできません。先に、ほかの人を有効な管理者にしてから、もう一度お試しください。",
  duplicateEmail: "このメールアドレスはすでに使われています。別のメールアドレスを入力してください。",
  noChange: "変更する内容がありません。内容を変えてから、もう一度お試しください。",
  retiredToLeave:
    "退職から休職には変更できません。有効に戻すと、一時パスワードが再発行されます。有効にしてから、もう一度お試しください。",
  failed: "処理に失敗しました。しばらくしてから、もう一度お試しください。",
  logWarning: "操作は完了しましたが、操作の記録に失敗しました。開発者に連絡してください。",
} as const;

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

// ---- 共通の確認 -------------------------------------------------------

// 操作する人が、今この時点で同じお店の有効な管理者か（requireAdmin の後でも、もう一度確かめる）
async function verifyActor(db: SupabaseClient, actor: Actor): Promise<boolean> {
  const { data, error } = await db
    .from("profiles")
    .select("role, status, shop_id")
    .eq("user_id", actor.userId)
    .eq("shop_id", actor.shopId);
  if (error || !data || data.length !== 1) return false;
  return data[0].role === "admin" && data[0].status === "active";
}

// 対象の人を、操作する人と同じお店の中だけから探す（別のお店の人は「見つからない」と同じ扱い）
async function loadTarget(db: SupabaseClient, actor: Actor, targetId: string): Promise<TargetRow | null> {
  const { data, error } = await db
    .from("profiles")
    .select("user_id, shop_id, display_name, role, status")
    .eq("user_id", targetId)
    .eq("shop_id", actor.shopId);
  if (error || !data || data.length !== 1) return null;
  return data[0] as TargetRow;
}

// 対象の人を除いて、そのお店に有効な管理者が1人以上いるか（分かりやすいメッセージ用の事前確認。
// 同時操作はDBのトリガーが最後の砦になる）
export async function otherActiveAdminExists(db: SupabaseClient, shopId: string, excludeUserId: string): Promise<boolean> {
  const { count, error } = await db
    .from("profiles")
    .select("user_id", { count: "exact", head: true })
    .eq("shop_id", shopId)
    .eq("status", "active")
    .eq("role", "admin")
    .neq("user_id", excludeUserId);
  if (error) throw new Error("管理者の人数を確認できませんでした");
  return (count ?? 0) >= 1;
}

const isActiveAdmin = (t: TargetRow) => t.status === "active" && t.role === "admin";

// DBのトリガー（last_active_admin）が止めたときは、日本語のメッセージにする
function updateErrorMessage(error: { message?: string } | null): string {
  if (error?.message?.includes("last_active_admin")) return MSG.lastAdmin;
  return MSG.failed;
}

// Auth 側のメールアドレス重複のエラーか
function isDuplicateEmailError(error: { code?: string; status?: number; message?: string }): boolean {
  if (error.code === "email_exists" || error.code === "user_already_exists") return true;
  return error.status === 422 && /already|registered|exists/i.test(error.message ?? "");
}

// 他のアカウント（どのお店でも。Auth のメールアドレスは全体で一意）がこのメールアドレスを使っているか
// MVP は少人数のため、一覧を順に読んで探す（最大 20 ページ × 1000 件）
async function emailUsedByOther(db: SupabaseClient, email: string, exceptUserId: string): Promise<boolean | "error"> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data) return "error";
    if (data.users.some((u) => u.id !== exceptUserId && (u.email ?? "").toLowerCase() === email)) return true;
    if (data.users.length < 1000) return false;
  }
  return "error"; // 想定を超える件数。安全側（変更しない）に倒す
}

// admin_logs に1行追記する。detail にパスワードは入れない（呼ぶ側も入れない）
async function writeLog(
  db: SupabaseClient,
  actor: Actor,
  targetId: string,
  action: "create" | "reissue" | "status" | "role" | "edit",
  detail: Record<string, unknown>,
): Promise<boolean> {
  const { error } = await db.from("admin_logs").insert({
    shop_id: actor.shopId,
    actor_id: actor.userId,
    target_id: targetId,
    action,
    detail,
  });
  if (error) {
    console.error("管理者操作の記録に失敗しました");
    return false;
  }
  return true;
}

// 成功の結果に、記録の失敗の知らせを付ける
function withLogWarning<T extends object>(result: T, logged: boolean): T & { warning?: string } {
  return logged ? result : { ...result, warning: MSG.logWarning };
}

// 一時パスワードを発行する：①must_change_password=true → ②パスワードを変更 の順。
// 途中で失敗しても「印だけ付いた」状態になるだけで、誰も知らないパスワードで入れる状態にはならない
async function issueTemporaryPassword(
  db: SupabaseClient,
  shopId: string,
  userId: string,
): Promise<{ ok: true; password: string } | { ok: false }> {
  const password = generateTemporaryPassword();

  const { data, error } = await db
    .from("profiles")
    .update({ must_change_password: true, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("shop_id", shopId)
    .select("user_id");
  if (error || data?.length !== 1) return { ok: false };

  const { error: authError } = await db.auth.admin.updateUserById(userId, { password });
  if (authError) {
    console.error("一時パスワードの設定に失敗しました", { status: authError.status, code: authError.code });
    return { ok: false };
  }
  return { ok: true, password };
}

function parse<S extends z.ZodType>(schema: S, input: unknown): { ok: true; data: z.output<S> } | { ok: false; error: string } {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return fail(firstIssueMessage(parsed.error));
  return { ok: true, data: parsed.data };
}

// ---- 1. メンバー追加 --------------------------------------------------

export async function createMember(db: SupabaseClient, actor: Actor, input: unknown): Promise<PasswordResult> {
  const parsed = parse(createMemberSchema, input);
  if (!parsed.ok) return parsed;
  if (!(await verifyActor(db, actor))) return fail(MSG.notAdmin);

  const { displayName, email, role } = parsed.data;
  const password = generateTemporaryPassword();

  // email_confirm: true：確認メールを送らずに、すぐログインできる状態で作る
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) {
    if (error && isDuplicateEmailError(error)) return fail(MSG.duplicateEmail);
    console.error("Auth ユーザーの作成に失敗しました", { status: error?.status, code: error?.code });
    return fail(MSG.failed);
  }
  const userId = data.user.id;

  const { error: profileError } = await db.from("profiles").insert({
    user_id: userId,
    shop_id: actor.shopId,
    display_name: displayName,
    role,
    status: "active",
    must_change_password: true,
  });
  if (profileError) {
    // profiles を作れなかったら、作った Auth ユーザーを消して元に戻す
    const { error: rollbackError } = await db.auth.admin.deleteUser(userId);
    if (rollbackError) {
      console.error("追加の取り消しに失敗しました。Auth に不完全なアカウントが残っています", { userId });
      return fail("メンバーを追加できませんでした。不完全なアカウントが残っている可能性があります。開発者に連絡してください。");
    }
    return fail(MSG.failed);
  }

  const logged = await writeLog(db, actor, userId, "create", {
    after: { display_name: displayName, email, role, status: "active" },
  });
  return withLogWarning({ ok: true as const, userId, temporaryPassword: password }, logged);
}

// ---- 2. 一時パスワードの再発行 ----------------------------------------

export async function reissuePassword(db: SupabaseClient, actor: Actor, input: unknown): Promise<PasswordResult> {
  const parsed = parse(reissueSchema, input);
  if (!parsed.ok) return parsed;
  if (!(await verifyActor(db, actor))) return fail(MSG.notAdmin);

  // 自分自身は拒否（自分のパスワードは、ログイン後のメニューのパスワード変更から変える）
  if (parsed.data.targetId === actor.userId) return fail(MSG.selfReissue);

  const target = await loadTarget(db, actor, parsed.data.targetId);
  if (!target) return fail(MSG.notFound);

  const issued = await issueTemporaryPassword(db, actor.shopId, target.user_id);
  if (!issued.ok) return fail("一時パスワードを再発行できませんでした。しばらくしてから、もう一度お試しください。");

  const logged = await writeLog(db, actor, target.user_id, "reissue", { must_change_password: { from: null, to: true } });
  return withLogWarning({ ok: true as const, userId: target.user_id, temporaryPassword: issued.password }, logged);
}

// ---- 3. 状態の変更（有効／休職／退職）---------------------------------

// 退職 → 有効のときだけ temporaryPassword が付く（それ以外は付かない）
export type StatusResult = ActionResult<{ userId: string; temporaryPassword?: string }>;

export async function changeStatus(db: SupabaseClient, actor: Actor, input: unknown): Promise<StatusResult> {
  const parsed = parse(changeStatusSchema, input);
  if (!parsed.ok) return parsed;
  if (!(await verifyActor(db, actor))) return fail(MSG.notAdmin);

  const { targetId, status } = parsed.data;
  if (targetId === actor.userId) return fail(MSG.selfStatus);

  const target = await loadTarget(db, actor, targetId);
  if (!target) return fail(MSG.notFound);
  if (target.status === status) return fail(MSG.noChange);

  // 退職 → 休職を許すと、「休職 → 有効」で一時パスワードの再発行を飛ばせてしまう
  if (target.status === "retired" && status === "leave") return fail(MSG.retiredToLeave);

  // 有効な管理者を外す変更は、事前に「ほかに有効な管理者がいるか」を確かめる
  if (isActiveAdmin(target) && status !== "active") {
    if (!(await otherActiveAdminExists(db, actor.shopId, target.user_id))) return fail(MSG.lastAdmin);
  }

  // 退職 → 有効：一時パスワードの再発行 → 状態を有効、の順（途中で失敗しても退職のまま）
  let temporaryPassword: string | undefined;
  if (target.status === "retired" && status === "active") {
    const issued = await issueTemporaryPassword(db, actor.shopId, target.user_id);
    if (!issued.ok) {
      return fail("一時パスワードを再発行できなかったため、退職のままにしています。しばらくしてから、もう一度お試しください。");
    }
    temporaryPassword = issued.password;
  }

  const { data, error } = await db
    .from("profiles")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("user_id", target.user_id)
    .eq("shop_id", actor.shopId)
    .select("user_id");
  if (error || data?.length !== 1) return fail(updateErrorMessage(error));

  const logged = await writeLog(db, actor, target.user_id, "status", {
    status: { from: target.status, to: status },
    // パスワードそのものは入れない。再発行したかどうかだけを残す
    password_reissued: temporaryPassword !== undefined,
  });
  return withLogWarning(
    temporaryPassword === undefined
      ? { ok: true as const, userId: target.user_id }
      : { ok: true as const, userId: target.user_id, temporaryPassword },
    logged,
  );
}

// ---- 4. ロールの変更 --------------------------------------------------

export async function changeRole(db: SupabaseClient, actor: Actor, input: unknown): Promise<ActionResult<{ userId: string }>> {
  const parsed = parse(changeRoleSchema, input);
  if (!parsed.ok) return parsed;
  if (!(await verifyActor(db, actor))) return fail(MSG.notAdmin);

  const { targetId, role } = parsed.data;
  if (targetId === actor.userId) return fail(MSG.selfRole);

  const target = await loadTarget(db, actor, targetId);
  if (!target) return fail(MSG.notFound);
  if (target.role === role) return fail(MSG.noChange);

  if (isActiveAdmin(target) && role !== "admin") {
    if (!(await otherActiveAdminExists(db, actor.shopId, target.user_id))) return fail(MSG.lastAdmin);
  }

  const { data, error } = await db
    .from("profiles")
    .update({ role, updated_at: new Date().toISOString() })
    .eq("user_id", target.user_id)
    .eq("shop_id", actor.shopId)
    .select("user_id");
  if (error || data?.length !== 1) return fail(updateErrorMessage(error));

  const logged = await writeLog(db, actor, target.user_id, "role", { role: { from: target.role, to: role } });
  return withLogWarning({ ok: true as const, userId: target.user_id }, logged);
}

// ---- 5. 名前・メールアドレスの編集 ------------------------------------

export async function editMember(db: SupabaseClient, actor: Actor, input: unknown): Promise<ActionResult<{ userId: string }>> {
  const parsed = parse(editMemberSchema, input);
  if (!parsed.ok) return parsed;
  if (!(await verifyActor(db, actor))) return fail(MSG.notAdmin);

  const { targetId, displayName, email } = parsed.data;
  const target = await loadTarget(db, actor, targetId);
  if (!target) return fail(MSG.notFound);

  const { data: authData, error: authReadError } = await db.auth.admin.getUserById(target.user_id);
  if (authReadError || !authData.user) return fail(MSG.failed);
  const currentEmail = (authData.user.email ?? "").toLowerCase();

  const nameChanged = displayName !== undefined && displayName !== target.display_name;
  const emailChanged = email !== undefined && email !== currentEmail;
  if (!nameChanged && !emailChanged) return fail(MSG.noChange);

  // 失敗しやすい Auth のメール変更を先に行う（重複は Auth が決める。email_confirm: true で確認メールを送らない）
  if (emailChanged) {
    // Auth の update は重複のとき汎用の 500 エラーを返し、理由で見分けられないため、先に自分で確かめる
    const inUse = await emailUsedByOther(db, email!, target.user_id);
    if (inUse === "error") return fail(MSG.failed);
    if (inUse) return fail(MSG.duplicateEmail);

    const { error } = await db.auth.admin.updateUserById(target.user_id, { email, email_confirm: true });
    if (error) {
      if (isDuplicateEmailError(error)) return fail(MSG.duplicateEmail);
      console.error("メールアドレスの変更に失敗しました", { status: error.status, code: error.code });
      return fail(MSG.failed);
    }
  }

  if (nameChanged) {
    const { data, error } = await db
      .from("profiles")
      .update({ display_name: displayName, updated_at: new Date().toISOString() })
      .eq("user_id", target.user_id)
      .eq("shop_id", actor.shopId)
      .select("user_id");
    if (error || data?.length !== 1) {
      // メールだけ変わった状態を残さない：元のメールアドレスに戻す
      if (emailChanged) {
        const { error: revertError } = await db.auth.admin.updateUserById(target.user_id, {
          email: currentEmail,
          email_confirm: true,
        });
        if (revertError) console.error("メールアドレスを元に戻せませんでした", { userId: target.user_id });
      }
      return fail(MSG.failed);
    }
  }

  const detail: Record<string, unknown> = {};
  if (nameChanged) detail.display_name = { from: target.display_name, to: displayName };
  if (emailChanged) detail.email = { from: currentEmail, to: email };
  const logged = await writeLog(db, actor, target.user_id, "edit", detail);
  return withLogWarning({ ok: true as const, userId: target.user_id }, logged);
}
