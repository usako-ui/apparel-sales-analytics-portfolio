// 認可の入口（lib/auth の resolveAccount＋decideAccess）の結合テスト。検証用 Supabase に実際につないで確かめる
// 実行：npm run test:rls
//
// 状態を変えるテストは、このテスト専用の一時アカウント（@example.com・終了時に削除）で行う。
// 理由：rls.test.ts が TEST_OPERATOR の status を一時的に変えるため、同じアカウントを使うと
//       ファイルを並列で実行したときにお互いの結果を壊してしまう
import { randomBytes, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { decideAccess } from "@/lib/auth/access";
import { resolveAccount } from "@/lib/auth/account";
import { createAnonClient, createServiceClient, requireEnv, signInAs } from "./helpers";

const service = createServiceClient();
const TEMP_PREFIX = "guard-test-";

let tempUserId = "";
let tempClient: SupabaseClient;
let shopId = "";

// 前回の中断で残った一時アカウントを消す
async function sweepTempUsers() {
  const { data, error } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(`一時アカウントの確認に失敗しました：${error.message}`);
  for (const user of data.users) {
    const email = user.email ?? "";
    if (email.startsWith(TEMP_PREFIX) && email.endsWith("@example.com")) {
      await service.auth.admin.deleteUser(user.id);
    }
  }
}

async function patchProfile(patch: Record<string, unknown>) {
  const { error } = await service.from("profiles").update(patch).eq("user_id", tempUserId);
  expect(error).toBeNull();
}

beforeAll(async () => {
  await sweepTempUsers();

  // LUMINA のお店 ID はテスト用管理者のアカウントから取る
  const admin = await signInAs("TEST_ADMIN");
  const adminResult = await resolveAccount(admin);
  expect(adminResult.status).toBe("ok");
  if (adminResult.status === "ok") shopId = adminResult.account.shopId;

  // 一時アカウント（操作者・有効・パスワード変更済み）。パスワードはこのテストの中で作り、どこにも出さない
  const email = `${TEMP_PREFIX}${randomUUID()}@example.com`;
  const password = `${randomBytes(12).toString("hex")}Aa1`;
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error("一時アカウントの作成に失敗しました");
  tempUserId = data.user.id;

  const { error: profileError } = await service.from("profiles").insert({
    user_id: tempUserId,
    shop_id: shopId,
    display_name: "ガードのテスト",
    role: "operator",
    status: "active",
    must_change_password: false,
  });
  if (profileError) throw new Error("一時アカウントの profiles 作成に失敗しました");

  tempClient = createAnonClient();
  const signIn = await tempClient.auth.signInWithPassword({ email, password });
  if (signIn.error) throw new Error("一時アカウントでログインできませんでした");
});

afterAll(async () => {
  // 必ず実行：一時アカウントを消す（profiles は CASCADE で一緒に消える）
  if (tempUserId) await service.auth.admin.deleteUser(tempUserId);
});

describe("ログインしていない", () => {
  it("anon クライアントは signedOut", async () => {
    const result = await resolveAccount(createAnonClient());
    expect(result.status).toBe("signedOut");
  });
});

describe("テスト用の管理者（変更しない）", () => {
  it("有効で、管理者の画面・処理も通る", async () => {
    const admin = await signInAs("TEST_ADMIN");
    const result = await resolveAccount(admin);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.account.role).toBe("admin");
    expect(result.account.email).toBe(requireEnv("TEST_ADMIN_EMAIL"));
    expect(decideAccess(result.account)).toBe("allow");
    expect(decideAccess(result.account, { requireAdmin: true })).toBe("allow");
  });
});

describe("一時アカウント：状態を変えると次の呼び出しから反映される（AC-16）", () => {
  it("有効 → 通る。操作者は管理者の画面・処理を通らない", async () => {
    const result = await resolveAccount(tempClient);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.account.role).toBe("operator");
    expect(result.account.shopId).toBe(shopId);
    expect(decideAccess(result.account)).toBe("allow");
    expect(decideAccess(result.account, { requireAdmin: true })).toBe("forbidden");
  });

  it("休職・退職にすると同じセッションのまま次の呼び出しで拒否され、有効に戻すと通る", async () => {
    try {
      for (const status of ["leave", "retired"] as const) {
        await patchProfile({ status });
        const result = await resolveAccount(tempClient);
        expect(result.status).toBe("suspended");
      }
      await patchProfile({ status: "active" });
      const restored = await resolveAccount(tempClient);
      expect(restored.status).toBe("ok");
    } finally {
      await patchProfile({ status: "active" });
    }
  });

  it("profiles の行が消えた場合も停止中として扱う", async () => {
    // 行を消して、finally で同じ内容を入れ直す
    const { data: backup, error: backupError } = await service.from("profiles").select("*").eq("user_id", tempUserId);
    expect(backupError).toBeNull();
    expect(backup).toHaveLength(1);
    try {
      const { error } = await service.from("profiles").delete().eq("user_id", tempUserId);
      expect(error).toBeNull();
      const result = await resolveAccount(tempClient);
      expect(result.status).toBe("suspended");
    } finally {
      await service.from("profiles").upsert(backup!, { onConflict: "user_id" });
    }
    const restored = await resolveAccount(tempClient);
    expect(restored.status).toBe("ok");
  });

  it("must_change_password=true だと /password 以外は拒否され、false に戻すと通る", async () => {
    try {
      await patchProfile({ must_change_password: true });
      const result = await resolveAccount(tempClient);
      expect(result.status).toBe("ok");
      if (result.status !== "ok") return;
      expect(result.account.mustChangePassword).toBe(true);
      expect(decideAccess(result.account)).toBe("changePassword"); // ダッシュボードなど
      expect(decideAccess(result.account, { requireAdmin: true })).toBe("changePassword");
      expect(decideAccess(result.account, { onPasswordPage: true })).toBe("allow"); // /password
    } finally {
      await patchProfile({ must_change_password: false });
    }
    const restored = await resolveAccount(tempClient);
    expect(restored.status).toBe("ok");
    if (restored.status === "ok") expect(decideAccess(restored.account)).toBe("allow");
  });
});
