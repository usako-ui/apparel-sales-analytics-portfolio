// 管理者画面の処理（lib/admin/members.ts）の結合テスト。検証用 Supabase に実際につないで確かめる
// 実行：npm run test:rls
//
// このテスト専用のお店・アカウント（@example.com・終了時に削除）だけを使う。TEST_* の既存アカウントは変えない。
// 理由：requireAdmin()（cookies を使う）は vitest から呼べないため、その後ろの処理の本体を直接呼ぶ。
//       requireAdmin 自体の判定は guard.test.ts / access.test.ts で確認済み。
import { randomBytes, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type Actor,
  changeRole,
  changeStatus,
  createMember,
  editMember,
  otherActiveAdminExists,
  reissuePassword,
} from "@/lib/admin/members";
import { decideAccess } from "@/lib/auth/access";
import { resolveAccount } from "@/lib/auth/account";
import { createAnonClient, createServiceClient, requireEnv } from "./helpers";

// DBのトリガー（supabase/migrations/20261026062100_last_admin_guard.sql）を適用したら true にする
// （適用前は、トリガーのテストを skip する）
const TRIGGER_APPLIED = true;

const service = createServiceClient();
const EMAIL_PREFIX = "t09-test-";
const SHOP_PREFIX = "T09テスト店舗";

type TempUser = { userId: string; email: string; password: string };

const issuedPasswords: string[] = []; // 返された一時パスワード。admin_logs に含まれないことの確認に使う

// ---- 後片付け ---------------------------------------------------------
// 有効な管理者を消すトリガーがあるため、管理者以外 → 管理者の順に消す
async function cleanup() {
  const { data } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const ids = (data?.users ?? [])
    .filter((u) => (u.email ?? "").startsWith(EMAIL_PREFIX) && (u.email ?? "").endsWith("@example.com"))
    .map((u) => u.id);

  if (ids.length > 0) {
    const { data: profiles } = await service.from("profiles").select("user_id, role").in("user_id", ids);
    const admins = new Set((profiles ?? []).filter((p) => p.role === "admin").map((p) => p.user_id as string));
    for (const id of ids.filter((i) => !admins.has(i))) await service.auth.admin.deleteUser(id);
    for (const id of ids.filter((i) => admins.has(i))) await service.auth.admin.deleteUser(id);
  }

  const { data: shops } = await service.from("shops").select("id").like("name", `${SHOP_PREFIX}%`);
  const shopIds = (shops ?? []).map((s) => s.id as string);
  if (shopIds.length > 0) {
    await service.from("admin_logs").delete().in("shop_id", shopIds);
    await service.from("shops").delete().in("id", shopIds);
  }
}

async function newShop(label: string): Promise<string> {
  const { data, error } = await service
    .from("shops")
    .insert({ name: `${SHOP_PREFIX}-${label}-${randomUUID().slice(0, 8)}` })
    .select("id")
    .single();
  if (error || !data) throw new Error("テスト用のお店を作れませんでした");
  return data.id as string;
}

async function newUser(shopId: string, role: "admin" | "operator", status = "active"): Promise<TempUser> {
  const email = `${EMAIL_PREFIX}${randomUUID()}@example.com`;
  const password = `${randomBytes(12).toString("hex")}Aa1`;
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error("テスト用アカウントを作れませんでした");
  const { error: profileError } = await service.from("profiles").insert({
    user_id: data.user.id,
    shop_id: shopId,
    display_name: "T09テスト",
    role,
    status,
    must_change_password: false,
  });
  if (profileError) throw new Error("テスト用の profiles を作れませんでした");
  return { userId: data.user.id, email, password };
}

async function readProfile(userId: string) {
  const { data, error } = await service
    .from("profiles")
    .select("shop_id, display_name, role, status, must_change_password")
    .eq("user_id", userId)
    .single();
  expect(error).toBeNull();
  return data!;
}

async function canSignIn(email: string, password: string): Promise<boolean> {
  const { error } = await createAnonClient().auth.signInWithPassword({ email, password });
  return !error;
}

async function readLogs(shopId: string) {
  const { data, error } = await service
    .from("admin_logs")
    .select("actor_id, target_id, action, detail, created_at")
    .eq("shop_id", shopId)
    .order("id");
  expect(error).toBeNull();
  return data ?? [];
}

async function findAuthUserByEmail(email: string) {
  const { data } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  return (data?.users ?? []).find((u) => u.email === email);
}

// 指定した処理だけを失敗させる db（途中で失敗したときの動作を確かめるため）
function failingDb(overrides: {
  updateUserById?: boolean;
  profilesInsert?: boolean;
}): SupabaseClient {
  return new Proxy(service, {
    get(target, prop) {
      const value = Reflect.get(target, prop) as unknown;
      if (prop === "auth" && overrides.updateUserById) {
        const auth = target.auth;
        return {
          ...auth,
          admin: {
            ...auth.admin,
            updateUserById: async () => ({ data: { user: null }, error: { status: 500, code: "test_failure", message: "x" } }),
            getUserById: auth.admin.getUserById.bind(auth.admin),
          },
        };
      }
      if (prop === "from" && overrides.profilesInsert) {
        return (table: string) => {
          const builder = target.from(table);
          if (table !== "profiles") return builder;
          return new Proxy(builder, {
            get(b, p) {
              if (p === "insert") return async () => ({ data: null, error: { message: "test failure" } });
              const v = Reflect.get(b, p) as unknown;
              return typeof v === "function" ? v.bind(b) : v;
            },
          });
        };
      }
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as SupabaseClient;
}

// ---- 準備 -------------------------------------------------------------
let shopA = "";
let shopB = "";
let adminA: TempUser;
let adminA2: TempUser;
let operatorA: TempUser;
let userB: TempUser;
let actorA: Actor;

beforeAll(async () => {
  await cleanup(); // 前回の中断で残ったものを消す
  shopA = await newShop("A");
  shopB = await newShop("B");
  adminA = await newUser(shopA, "admin");
  adminA2 = await newUser(shopA, "admin");
  operatorA = await newUser(shopA, "operator");
  userB = await newUser(shopB, "operator");
  actorA = { userId: adminA.userId, shopId: shopA };
});

afterAll(async () => {
  await cleanup(); // 必ず実行
});

// ---- テスト -----------------------------------------------------------
describe("操作者からの実行は拒否される", () => {
  it("5つの処理すべてが拒否され、何も変わらない", async () => {
    const actor: Actor = { userId: operatorA.userId, shopId: shopA };
    const before = await readProfile(adminA2.userId);

    const results = [
      await createMember(service, actor, { displayName: "不正", email: `${EMAIL_PREFIX}denied@example.com`, role: "operator" }),
      await reissuePassword(service, actor, { targetId: adminA2.userId }),
      await changeStatus(service, actor, { targetId: adminA2.userId, status: "leave" }),
      await changeRole(service, actor, { targetId: adminA2.userId, role: "operator" }),
      await editMember(service, actor, { targetId: adminA2.userId, displayName: "書き換え" }),
    ];
    for (const r of results) expect(r.ok).toBe(false);

    expect(await readProfile(adminA2.userId)).toEqual(before);
    expect(await findAuthUserByEmail(`${EMAIL_PREFIX}denied@example.com`)).toBeUndefined();
    expect(await readLogs(shopA)).toHaveLength(0);
  });

  it("休職中の管理者も拒否される（実行の時点の状態を確かめる）", async () => {
    const leaveAdmin = await newUser(shopA, "admin", "leave");
    const r = await changeRole(service, { userId: leaveAdmin.userId, shopId: shopA }, { targetId: operatorA.userId, role: "admin" });
    expect(r.ok).toBe(false);
    expect((await readProfile(operatorA.userId)).role).toBe("operator");
  });
});

describe("別のお店の人は対象にできない", () => {
  it("再発行・状態・ロール・編集が拒否され、別のお店の人は変わらない", async () => {
    const before = await readProfile(userB.userId);
    const results = [
      await reissuePassword(service, actorA, { targetId: userB.userId }),
      await changeStatus(service, actorA, { targetId: userB.userId, status: "retired" }),
      await changeRole(service, actorA, { targetId: userB.userId, role: "admin" }),
      await editMember(service, actorA, { targetId: userB.userId, displayName: "他店から書き換え" }),
    ];
    for (const r of results) expect(r.ok).toBe(false);

    expect(await readProfile(userB.userId)).toEqual(before);
    expect(await canSignIn(userB.email, userB.password)).toBe(true); // パスワードも変わっていない
    expect(await readLogs(shopB)).toHaveLength(0);
    expect(await readLogs(shopA)).toHaveLength(0);
  });
});

describe("自分自身への操作は拒否される", () => {
  it("休職・退職・操作者への変更が拒否される", async () => {
    for (const status of ["leave", "retired"] as const) {
      const r = await changeStatus(service, actorA, { targetId: adminA.userId, status });
      expect(r.ok).toBe(false);
    }
    const role = await changeRole(service, actorA, { targetId: adminA.userId, role: "operator" });
    expect(role.ok).toBe(false);

    const p = await readProfile(adminA.userId);
    expect(p.status).toBe("active");
    expect(p.role).toBe("admin");
    expect(await readLogs(shopA)).toHaveLength(0);
  });

  it("自分自身の一時パスワード再発行が拒否され、パスワードも変わらない", async () => {
    const r = await reissuePassword(service, actorA, { targetId: adminA.userId });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("パスワード変更");
    expect(await canSignIn(adminA.email, adminA.password)).toBe(true);
    expect((await readProfile(adminA.userId)).must_change_password).toBe(false);
    expect(await readLogs(shopA)).toHaveLength(0);
  });
});

describe("有効な管理者が0人になる変更（サーバー側の事前確認）", () => {
  it("そのお店に他の有効な管理者がいなければ false、いれば true", async () => {
    const shopC = await newShop("C");
    const lone = await newUser(shopC, "admin");
    await newUser(shopC, "operator");
    expect(await otherActiveAdminExists(service, shopC, lone.userId)).toBe(false);
    expect(await otherActiveAdminExists(service, shopA, adminA.userId)).toBe(true);
  });

  it("休職中の管理者は『他の有効な管理者』に数えない", async () => {
    const shopD = await newShop("D");
    const active = await newUser(shopD, "admin");
    await newUser(shopD, "admin", "leave");
    expect(await otherActiveAdminExists(service, shopD, active.userId)).toBe(false);
  });
});

describe("メンバー追加・再発行・状態・ロール・編集（正常系と記録）", () => {
  let member: { userId: string; email: string; password: string };

  it("メンバー追加：一時パスワードを1回返し、profiles は must_change_password=true、そのパスワードでログインできる", async () => {
    const email = `${EMAIL_PREFIX}${randomUUID()}@example.com`;
    const r = await createMember(service, actorA, { displayName: "追加テスト", email: email.toUpperCase().replace("@EXAMPLE.COM", "@example.com"), role: "operator" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.temporaryPassword).toHaveLength(16);
    issuedPasswords.push(r.temporaryPassword);
    member = { userId: r.userId, email, password: r.temporaryPassword };

    const p = await readProfile(member.userId);
    expect(p).toMatchObject({ shop_id: shopA, display_name: "追加テスト", role: "operator", status: "active", must_change_password: true });
    expect(await canSignIn(email, r.temporaryPassword)).toBe(true);
  });

  it("同じメールアドレスの追加は日本語のエラーで拒否され、Auth に余計なアカウントが増えない", async () => {
    const r = await createMember(service, actorA, { displayName: "重複", email: member.email, role: "operator" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("すでに使われています");

    const existing = requireEnv("TEST_ADMIN_EMAIL");
    const r2 = await createMember(service, actorA, { displayName: "重複2", email: existing, role: "operator" });
    expect(r2.ok).toBe(false);
  });

  it("入力が不正なら拒否される", async () => {
    const r = await createMember(service, actorA, { displayName: "", email: "not-an-email", role: "boss" });
    expect(r.ok).toBe(false);
  });

  it("profiles の作成に失敗したら、作った Auth ユーザーを消して元に戻す", async () => {
    const email = `${EMAIL_PREFIX}${randomUUID()}@example.com`;
    const r = await createMember(failingDb({ profilesInsert: true }), actorA, { displayName: "失敗", email, role: "operator" });
    expect(r.ok).toBe(false);
    expect(await findAuthUserByEmail(email)).toBeUndefined();
  });

  it("再発行：新しい一時パスワードでログインでき、古いパスワードは使えず、must_change_password=true", async () => {
    await service.from("profiles").update({ must_change_password: false }).eq("user_id", member.userId);
    const r = await reissuePassword(service, actorA, { targetId: member.userId });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    issuedPasswords.push(r.temporaryPassword);
    expect(r.temporaryPassword).not.toBe(member.password);

    expect(await canSignIn(member.email, member.password)).toBe(false);
    expect(await canSignIn(member.email, r.temporaryPassword)).toBe(true);
    expect((await readProfile(member.userId)).must_change_password).toBe(true);
    member.password = r.temporaryPassword;
  });

  it("再発行されると、ほかの端末でログインしたままの本人も、次の操作から /password 以外を使えない", async () => {
    // 別の端末のログイン状態（再発行より前に取ったセッション）。パスワード変更済みの状態にしておく
    await service.from("profiles").update({ must_change_password: false }).eq("user_id", member.userId);
    const otherDevice = createAnonClient();
    const signIn = await otherDevice.auth.signInWithPassword({ email: member.email, password: member.password });
    expect(signIn.error).toBeNull();
    const before = await resolveAccount(otherDevice);
    expect(before.status).toBe("ok");
    if (before.status === "ok") expect(decideAccess(before.account)).toBe("allow");

    const r = await reissuePassword(service, actorA, { targetId: member.userId });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    issuedPasswords.push(r.temporaryPassword);
    member.password = r.temporaryPassword;

    // 同じセッションのまま、次の確認（guard と同じ resolveAccount＋decideAccess）で変わる
    const after = await resolveAccount(otherDevice);
    expect(after.status).toBe("ok");
    if (after.status !== "ok") return;
    expect(after.account.mustChangePassword).toBe(true);
    expect(decideAccess(after.account)).toBe("changePassword"); // ダッシュボードなど
    expect(decideAccess(after.account, { requireAdmin: true })).toBe("changePassword");
    expect(decideAccess(after.account, { onPasswordPage: true })).toBe("allow"); // /password だけ
  });

  it("休職 → 有効：パスワードはそのまま（再発行されない）", async () => {
    const toLeave = await changeStatus(service, actorA, { targetId: member.userId, status: "leave" });
    expect(toLeave.ok).toBe(true);
    expect((await readProfile(member.userId)).status).toBe("leave");

    const back = await changeStatus(service, actorA, { targetId: member.userId, status: "active" });
    expect(back.ok).toBe(true);
    if (back.ok) expect(back.temporaryPassword).toBeUndefined();
    expect(await canSignIn(member.email, member.password)).toBe(true);
  });

  it("退職 → 休職は拒否される（有効に戻すときの再発行を飛ばせないため）", async () => {
    expect((await changeStatus(service, actorA, { targetId: member.userId, status: "retired" })).ok).toBe(true);
    const r = await changeStatus(service, actorA, { targetId: member.userId, status: "leave" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("退職から休職には変更できません");
    expect((await readProfile(member.userId)).status).toBe("retired");
  });

  it("退職 → 有効：一時パスワードが再発行され、must_change_password=true、状態が有効になる", async () => {
    const r = await changeStatus(service, actorA, { targetId: member.userId, status: "active" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.temporaryPassword).toHaveLength(16);
    issuedPasswords.push(r.temporaryPassword!);

    const p = await readProfile(member.userId);
    expect(p.status).toBe("active");
    expect(p.must_change_password).toBe(true);
    expect(await canSignIn(member.email, member.password)).toBe(false); // 古いパスワードは使えない
    expect(await canSignIn(member.email, r.temporaryPassword!)).toBe(true);
    member.password = r.temporaryPassword!;
  });

  it("退職 → 有効の途中（パスワード変更）で失敗したら、退職のまま", async () => {
    expect((await changeStatus(service, actorA, { targetId: member.userId, status: "retired" })).ok).toBe(true);
    const r = await changeStatus(failingDb({ updateUserById: true }), actorA, { targetId: member.userId, status: "active" });
    expect(r.ok).toBe(false);
    expect((await readProfile(member.userId)).status).toBe("retired");
    expect(await canSignIn(member.email, member.password)).toBe(true); // パスワードも変わっていない

    // 後続のテストのため、有効に戻しておく
    const back = await changeStatus(service, actorA, { targetId: member.userId, status: "active" });
    expect(back.ok).toBe(true);
    if (back.ok) {
      issuedPasswords.push(back.temporaryPassword!);
      member.password = back.temporaryPassword!;
    }
  });

  it("ロールの変更：操作者 → 管理者 → 操作者", async () => {
    expect((await changeRole(service, actorA, { targetId: member.userId, role: "admin" })).ok).toBe(true);
    expect((await readProfile(member.userId)).role).toBe("admin");
    expect((await changeRole(service, actorA, { targetId: member.userId, role: "operator" })).ok).toBe(true);
    expect((await readProfile(member.userId)).role).toBe("operator");
    // 同じロールへの変更は拒否
    expect((await changeRole(service, actorA, { targetId: member.userId, role: "operator" })).ok).toBe(false);
  });

  it("名前の編集・メールアドレスの編集（新しいメールでログインできる）", async () => {
    const nameOnly = await editMember(service, actorA, { targetId: member.userId, displayName: "  編集後の名前 " });
    expect(nameOnly.ok).toBe(true);
    expect((await readProfile(member.userId)).display_name).toBe("編集後の名前");

    const newEmail = `${EMAIL_PREFIX}${randomUUID()}@example.com`;
    const r = await editMember(service, actorA, { targetId: member.userId, email: newEmail });
    expect(r.ok).toBe(true);
    expect(await canSignIn(newEmail, member.password)).toBe(true);
    expect(await canSignIn(member.email, member.password)).toBe(false);
    member.email = newEmail;

    // 変更なしは拒否
    expect((await editMember(service, actorA, { targetId: member.userId, displayName: "編集後の名前" })).ok).toBe(false);
  });

  it("メールアドレスの編集：他のアカウントと重複したら日本語のエラーで拒否され、メールは変わらない", async () => {
    const r = await editMember(service, actorA, { targetId: member.userId, email: operatorA.email });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("すでに使われています");
    expect(await canSignIn(member.email, member.password)).toBe(true);
  });

  it("admin_logs：5種類の操作が記録され、誰が・誰に・変更前→後があり、パスワードを含まない", async () => {
    const logs = await readLogs(shopA);
    const actions = new Set(logs.map((l) => l.action));
    for (const a of ["create", "reissue", "status", "role", "edit"]) expect(actions.has(a)).toBe(true);

    for (const l of logs) {
      expect(l.actor_id).toBe(adminA.userId);
      expect(l.target_id).toBeTruthy();
      expect(l.created_at).toBeTruthy();
    }
    const statusLog = logs.find((l) => l.action === "status");
    expect(statusLog?.detail).toMatchObject({ status: { from: expect.any(String), to: expect.any(String) } });
    const roleLog = logs.find((l) => l.action === "role");
    expect(roleLog?.detail).toMatchObject({ role: { from: "operator", to: "admin" } });

    // 返された一時パスワードが、記録のどこにも含まれない
    const text = JSON.stringify(logs);
    expect(issuedPasswords.length).toBeGreaterThanOrEqual(3);
    for (const pw of issuedPasswords) expect(text).not.toContain(pw);
    // 別のお店の記録は混ざらない
    expect(await readLogs(shopB)).toHaveLength(0);
  });
});

// ---- DBのトリガー（適用前は skip）-------------------------------------
describe.skipIf(!TRIGGER_APPLIED)("DBのトリガー：有効な管理者が0人になる変更を止める", () => {
  async function shopWithAdmins(label: string, adminCount: number, withOperator = false) {
    const shopId = await newShop(label);
    const admins: TempUser[] = [];
    for (let i = 0; i < adminCount; i++) admins.push(await newUser(shopId, "admin"));
    const operator = withOperator ? await newUser(shopId, "operator") : undefined;
    return { shopId, admins, operator };
  }

  it("最後の有効な管理者の ロール変更・休職・退職・削除 はDBが拒否する", async () => {
    const { admins, operator } = await shopWithAdmins("T1", 2, true);
    const [a1, a2] = admins;

    // 1人目を外すのは通る（もう1人残る）
    const ok = await service.from("profiles").update({ role: "operator" }).eq("user_id", a1.userId);
    expect(ok.error).toBeNull();

    // 2人目（最後）は止まる
    for (const patch of [{ role: "operator" }, { status: "leave" }, { status: "retired" }]) {
      const { error } = await service.from("profiles").update(patch).eq("user_id", a2.userId);
      expect(error?.message).toContain("last_active_admin");
    }
    const del = await service.from("profiles").delete().eq("user_id", a2.userId);
    expect(del.error?.message).toContain("last_active_admin");
    expect((await readProfile(a2.userId)).role).toBe("admin");

    // 管理者以外の変更・管理者のまま名前を変える変更は通る
    expect((await service.from("profiles").update({ status: "retired" }).eq("user_id", operator!.userId)).error).toBeNull();
    expect((await service.from("profiles").update({ display_name: "名前だけ" }).eq("user_id", a2.userId)).error).toBeNull();
  });

  it("管理者がまだいないお店に、最初の管理者を入れる操作は止めない", async () => {
    const shopId = await newShop("T2");
    const first = await newUser(shopId, "admin"); // newUser が profiles の insert を行う。エラーなら例外になる
    expect((await readProfile(first.userId)).role).toBe("admin");
  });

  it("休職中の管理者しかいないお店で、有効な管理者を外すのは止める", async () => {
    const shopId = await newShop("T3");
    const active = await newUser(shopId, "admin");
    await newUser(shopId, "admin", "leave");
    await newUser(shopId, "operator");
    const { error } = await service.from("profiles").update({ role: "operator" }).eq("user_id", active.userId);
    expect(error?.message).toContain("last_active_admin");
  });

  it("実行の直前に操作者へ外された管理者は、サーバーの処理でも拒否される（残る管理者は守られる）", async () => {
    const { shopId, admins } = await shopWithAdmins("T4", 2);
    const [a1, a2] = admins;
    expect((await service.from("profiles").update({ role: "operator" }).eq("user_id", a1.userId)).error).toBeNull();
    const r = await changeRole(service, { userId: a1.userId, shopId }, { targetId: a2.userId, role: "operator" });
    expect(r.ok).toBe(false);
    expect((await readProfile(a2.userId)).role).toBe("admin");
  });

  it("同時に2人がお互いを外しても、有効な管理者は0人にならない", async () => {
    for (let round = 0; round < 5; round++) {
      const { shopId, admins } = await shopWithAdmins(`T5-${round}`, 2);
      const [a1, a2] = admins;

      const results = await Promise.all([
        service.from("profiles").update({ role: "operator" }).eq("user_id", a1.userId),
        service.from("profiles").update({ role: "operator" }).eq("user_id", a2.userId),
      ]);
      const errors = results.filter((r) => r.error);
      expect(errors).toHaveLength(1);
      expect(errors[0].error?.message).toContain("last_active_admin");

      const { count } = await service
        .from("profiles")
        .select("user_id", { count: "exact", head: true })
        .eq("shop_id", shopId)
        .eq("status", "active")
        .eq("role", "admin");
      expect(count).toBe(1);
    }
  });

  it("他のメンバーが1人もいないお店の最後の1人は削除できる（後片付け用）", async () => {
    const { admins } = await shopWithAdmins("T6", 1);
    const { error } = await service.from("profiles").delete().eq("user_id", admins[0].userId);
    expect(error).toBeNull();
  });
});
