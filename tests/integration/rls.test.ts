// RLS（行レベルセキュリティ）の自動テスト。検証用 Supabase に実際につないで確かめる
// 実行：npm run test:rls（.env.local の値は vitest.config.ts が渡す）
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAnonClient, createServiceClient, makeRow, signInAs, TEST_MONTH } from "./helpers";

const service = createServiceClient();

let admin: SupabaseClient;
let operator: SupabaseClient;
let other: SupabaseClient;
let operatorUserId: string;
let luminaShopId: string;
let otherShopId: string;
let luminaUploadId: string;
let otherUploadId: string;

// テスト専用の月のデータを消す（uploads を消すと sales_data・reports も CASCADE で消える）
async function cleanupTestMonth() {
  const { error } = await service.from("uploads").delete().eq("target_month", TEST_MONTH);
  if (error) throw new Error(`後片付けに失敗しました：${error.message}`);
}

// 操作者を有効に戻す（失敗しても例外にせず、結果だけ返す）
async function restoreOperatorActive() {
  if (!operatorUserId) return;
  await service.from("profiles").update({ status: "active" }).eq("user_id", operatorUserId);
}

beforeAll(async () => {
  [admin, operator, other] = await Promise.all([signInAs("TEST_ADMIN"), signInAs("TEST_OPERATOR"), signInAs("TEST_OTHER_SHOP")]);

  const { data: operatorUser } = await operator.auth.getUser();
  operatorUserId = operatorUser.user?.id ?? "";
  expect(operatorUserId).not.toBe("");

  // 前回の中断が残っていても同じ状態から始める
  await restoreOperatorActive();
  await cleanupTestMonth();

  // お店IDは自分のお店の shops から取る（RLS で自分のお店1件だけ見える）
  const { data: luminaShops } = await admin.from("shops").select("id");
  const { data: otherShops } = await other.from("shops").select("id");
  expect(luminaShops).toHaveLength(1);
  expect(otherShops).toHaveLength(1);
  luminaShopId = luminaShops![0].id;
  otherShopId = otherShops![0].id;
  expect(luminaShopId).not.toBe(otherShopId);

  // 準備：LUMINA の admin（2行）とテスト用のお店の admin（1行）が 2099-01 を入れる
  const first = await admin.rpc("replace_month_uploads", {
    p_filename: "rls-test-lumina.csv",
    p_months: [{ target_month: TEST_MONTH, rows: [makeRow("01", "RLS-A", 1000, 400), makeRow("02", "RLS-B", 2000, 900)] }],
  });
  expect(first.error).toBeNull();
  luminaUploadId = first.data[0].upload_id;

  const second = await other.rpc("replace_month_uploads", {
    p_filename: "rls-test-other.csv",
    p_months: [{ target_month: TEST_MONTH, rows: [makeRow("03", "RLS-C", 3000, 1000)] }],
  });
  expect(second.error).toBeNull();
  otherUploadId = second.data[0].upload_id;

  // 別店から見えないことを確かめるための report（LUMINA 側）
  const report = await admin.from("reports").insert({
    upload_id: luminaUploadId,
    shop_id: luminaShopId,
    target_month: TEST_MONTH,
    result: { test: true },
    llm_provider: "gemini",
  });
  expect(report.error).toBeNull();
});

afterAll(async () => {
  // 必ず実行：操作者を active に戻し、テスト用の月のデータを消す
  await restoreOperatorActive();
  await cleanupTestMonth();
});

describe("同じお店", () => {
  it("操作者から uploads・sales_data が見え、件数が管理者と同じ", async () => {
    const [aUp, oUp] = await Promise.all([
      admin.from("uploads").select("id").eq("target_month", TEST_MONTH),
      operator.from("uploads").select("id").eq("target_month", TEST_MONTH),
    ]);
    const [aSd, oSd] = await Promise.all([
      admin.from("sales_data").select("id").eq("upload_id", luminaUploadId),
      operator.from("sales_data").select("id").eq("upload_id", luminaUploadId),
    ]);
    expect(aUp.data).toHaveLength(1);
    expect(oUp.data).toHaveLength(aUp.data!.length);
    expect(aSd.data).toHaveLength(2);
    expect(oSd.data).toHaveLength(aSd.data!.length);
  });
});

describe("別のお店", () => {
  it("テスト用のお店の管理者から LUMINA の uploads・sales_data・reports が0件", async () => {
    const [up, sd, rp] = await Promise.all([
      other.from("uploads").select("id").eq("shop_id", luminaShopId),
      other.from("sales_data").select("id").eq("shop_id", luminaShopId),
      other.from("reports").select("id").eq("shop_id", luminaShopId),
    ]);
    expect(up.data).toHaveLength(0);
    expect(sd.data).toHaveLength(0);
    expect(rp.data).toHaveLength(0);
  });

  it("絞り込みなしで読んでも自分のお店の分だけ見える", async () => {
    const [up, sd, rp, pr, sh] = await Promise.all([
      other.from("uploads").select("shop_id"),
      other.from("sales_data").select("shop_id"),
      other.from("reports").select("shop_id"),
      other.from("profiles").select("shop_id"),
      other.from("shops").select("id"),
    ]);
    for (const result of [up, sd, rp, pr]) {
      expect(result.error).toBeNull();
      expect(result.data!.every((row) => row.shop_id === otherShopId)).toBe(true);
    }
    expect(sd.data!.length).toBeGreaterThanOrEqual(1); // 自店の 2099-01 の1行は必ず見える
    expect(sh.data).toHaveLength(1);
  });

  it("LUMINA の管理者から、別店の 2099-01 の明細は見えない",async () => {
    const { data } = await admin.from("sales_data").select("id").eq("upload_id", otherUploadId);
    expect(data).toHaveLength(0);
  });
});

describe("未ログイン（anon）", () => {
  it.each(["shops", "profiles", "uploads", "sales_data", "reports"])("%s は0件または権限エラー", async (table) => {
    const anon = createAnonClient();
    const { data, error } = await anon.from(table).select("*");
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });

  it("replace_month_uploads は拒否される", async () => {
    const anon = createAnonClient();
    const { error } = await anon.rpc("replace_month_uploads", {
      p_filename: "x.csv",
      p_months: [{ target_month: TEST_MONTH, rows: [makeRow("05", "RLS-X", 1, 1)] }],
    });
    expect(error).not.toBeNull();
  });
});

describe("書き込みの制限", () => {
  it("authenticated から profiles への insert・update が拒否される", async () => {
    const ins = await admin
      .from("profiles")
      .insert({ user_id: crypto.randomUUID(), shop_id: luminaShopId, display_name: "x", role: "admin" });
    expect(ins.error).not.toBeNull();

    // update はエラーまたは0件更新のどちらでも「変わらない」ことを確かめる
    const upd = await admin.from("profiles").update({ role: "operator" }).eq("shop_id", luminaShopId).select();
    expect(upd.error !== null || (upd.data ?? []).length === 0).toBe(true);
    const { data: roles } = await service.from("profiles").select("role").eq("shop_id", luminaShopId);
    expect(roles!.some((p) => p.role === "admin")).toBe(true);
  });

  it("authenticated から admin_logs への insert・update が拒否される", async () => {
    const ins = await admin.from("admin_logs").insert({ shop_id: luminaShopId, actor_id: crypto.randomUUID(), action: "edit" });
    expect(ins.error).not.toBeNull();

    const upd = await admin.from("admin_logs").update({ action: "create" }).eq("shop_id", luminaShopId).select();
    expect(upd.error !== null || (upd.data ?? []).length === 0).toBe(true);
  });

  it("sales_data に別のお店の shop_id を入れる insert が拒否される", async () => {
    const { error } = await admin.from("sales_data").insert({ ...makeRow("10", "RLS-Z", 1, 1), upload_id: luminaUploadId, shop_id: otherShopId });
    expect(error).not.toBeNull();
  });

  it("sales_data に別のお店の upload_id を入れる insert が拒否される", async () => {
    const { error } = await admin.from("sales_data").insert({ ...makeRow("10", "RLS-Z", 1, 1), upload_id: otherUploadId, shop_id: luminaShopId });
    expect(error).not.toBeNull();
    // 別店の upload_id と別店の shop_id の組み合わせも拒否される
    const second = await admin.from("sales_data").insert({ ...makeRow("10", "RLS-Z", 1, 1), upload_id: otherUploadId, shop_id: otherShopId });
    expect(second.error).not.toBeNull();
  });

  it("別のお店の uploads は削除できない", async () => {
    await admin.from("uploads").delete().eq("id", otherUploadId);
    const { data } = await service.from("uploads").select("id").eq("id", otherUploadId);
    expect(data).toHaveLength(1);
  });
});

describe("休職・退職", () => {
  const callReplace = (client: SupabaseClient) =>
    client.rpc("replace_month_uploads", {
      p_filename: "rls-test-blocked.csv",
      p_months: [{ target_month: TEST_MONTH, rows: [makeRow("20", "RLS-L", 1, 1)] }],
    });

  const setStatus = async (status: "active" | "leave" | "retired") => {
    const { error } = await service.from("profiles").update({ status }).eq("user_id", operatorUserId);
    expect(error).toBeNull();
  };

  it("leave・retired では同じセッションのままデータが見えず、置き換えも拒否され、active に戻すと見える", async () => {
    // 事前：見えている
    const before = await operator.from("sales_data").select("id").eq("upload_id", luminaUploadId);
    expect(before.data).toHaveLength(2);

    for (const status of ["leave", "retired"] as const) {
      await setStatus(status);
      const up = await operator.from("uploads").select("id");
      const sd = await operator.from("sales_data").select("id");
      expect(up.data ?? []).toHaveLength(0);
      expect(sd.data ?? []).toHaveLength(0);

      const replaced = await callReplace(operator);
      expect(replaced.error).not.toBeNull();
    }

    // 拒否されたので LUMINA の 2099-01 は元のまま（2行）
    const { data: rows } = await service.from("sales_data").select("id").eq("upload_id", luminaUploadId);
    expect(rows).toHaveLength(2);

    await setStatus("active");
    const after = await operator.from("sales_data").select("id").eq("upload_id", luminaUploadId);
    expect(after.data).toHaveLength(2);
  });
});

describe("補助関数", () => {
  it("rpc('current_shop_id') は API から呼べない", async () => {
    const { error } = await admin.rpc("current_shop_id");
    expect(error).not.toBeNull();
    const anonResult = await createAnonClient().rpc("current_shop_id");
    expect(anonResult.error).not.toBeNull();
  });
});
