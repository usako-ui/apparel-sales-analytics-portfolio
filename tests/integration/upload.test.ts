// CSV取り込み（lib/upload/import.ts）の結合テスト。検証用 Supabase に実際につないで確かめる
// 実行：npm run test:rls
// AC-03：同じCSVを2回取り込んでも sales_data の行数・合計が二重にならない
//
// 使う月は 2098-01・2098-02 だけ（rls.test.ts の 2099-01 や本物の月 2025-09〜11 に触らない）。
// 状態を変える操作者のテストは一時アカウント（@example.com・終了時に削除）で行う
// 理由：TEST_OPERATOR は rls.test.ts が status を一時的に変えるため、並列実行で壊し合う
import { randomBytes, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resolveAccount } from "@/lib/auth/account";
import { importSalesCsv, previewSalesCsv, type UploadFile } from "@/lib/upload/import";
import { createAnonClient, createServiceClient, signInAs } from "./helpers";

const service = createServiceClient();
const TEMP_PREFIX = "upload-test-";
const MONTHS = ["2098-01", "2098-02"];

let admin: SupabaseClient;
let other: SupabaseClient;
let operator: SupabaseClient;
let luminaShopId = "";
let otherShopId = "";
let tempUserId = "";

const HEADER = "order_date,customer_id,product_name,category,sku,quantity,revenue,cost";
const line = (date: string, sku: string, revenue: number, cost: number) =>
  `${date},cust-1,取込テスト商品,テスト,${sku},1,${revenue},${cost}`;
const csv = (...lines: string[]) => [HEADER, ...lines].join("\n");
const file = (text: string, name = "upload-test.csv"): UploadFile => new File([text], name);

// 1月3行（合計 6000 円）＋2月2行（合計 9000 円）
const TWO_MONTHS = csv(
  line("2098-01-01", "UP-A", 1000, 400),
  line("2098-01-02", "UP-B", 2000, 900),
  line("2098-01-03", "UP-C", 3000, 1000),
  line("2098-02-01", "UP-D", 4000, 1500),
  line("2098-02-02", "UP-E", 5000, 2000),
);

async function cleanupTestMonths() {
  const { error } = await service.from("uploads").delete().in("target_month", MONTHS);
  if (error) throw new Error(`後片付けに失敗しました：${error.message}`);
}

// 店・月ごとの行数と売上合計（service role で直接数える）
async function stats(shopId: string, month: string) {
  const { data, error } = await service
    .from("sales_data")
    .select("revenue, sku")
    .eq("shop_id", shopId)
    .like("order_date", `${month}-%`);
  expect(error).toBeNull();
  return {
    count: data!.length,
    sum: data!.reduce((total, r) => total + r.revenue, 0),
    skus: data!.map((r) => r.sku as string).sort(),
  };
}

async function uploadRows(shopId: string, month: string) {
  const { data, error } = await service.from("uploads").select("id, row_count").eq("shop_id", shopId).eq("target_month", month);
  expect(error).toBeNull();
  return data!;
}

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

beforeAll(async () => {
  await sweepTempUsers();
  await cleanupTestMonths();

  [admin, other] = await Promise.all([signInAs("TEST_ADMIN"), signInAs("TEST_OTHER_SHOP")]);
  const [a, o] = await Promise.all([resolveAccount(admin), resolveAccount(other)]);
  if (a.status !== "ok" || o.status !== "ok") throw new Error("テスト用アカウントの確認に失敗しました");
  luminaShopId = a.account.shopId;
  otherShopId = o.account.shopId;
  expect(luminaShopId).not.toBe(otherShopId);

  // 一時の操作者（LUMINA・有効・パスワード変更済み）。パスワードはここで作り、どこにも出さない
  const email = `${TEMP_PREFIX}${randomUUID()}@example.com`;
  const password = `${randomBytes(12).toString("hex")}Aa1`;
  const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw new Error("一時アカウントの作成に失敗しました");
  tempUserId = created.data.user.id;
  const profile = await service.from("profiles").insert({
    user_id: tempUserId,
    shop_id: luminaShopId,
    display_name: "取込テスト",
    role: "operator",
    status: "active",
    must_change_password: false,
  });
  if (profile.error) throw new Error("一時アカウントの profiles 作成に失敗しました");
  operator = createAnonClient();
  const signIn = await operator.auth.signInWithPassword({ email, password });
  if (signIn.error) throw new Error("一時アカウントでログインできませんでした");
});

afterAll(async () => {
  // 必ず実行：テスト用の月のデータと一時アカウントを消す
  await cleanupTestMonths();
  if (tempUserId) await service.auth.admin.deleteUser(tempUserId);
});

describe("同じCSVを2回取り込む（AC-03）", () => {
  it("上書きの指定があれば置き換わり、行数・合計は二重にならない。指定がなければ拒否され変わらない", async () => {
    await cleanupTestMonths();

    // 確認：まだ何もないので上書きになる月はない
    const preview = await previewSalesCsv(admin, luminaShopId, file(TWO_MONTHS));
    expect(preview.ok).toBe(true);
    if (preview.ok) {
      expect(preview.successCount).toBe(5);
      expect(preview.months).toEqual(MONTHS);
      expect(preview.overwriteMonths).toEqual([]);
    }

    // 1回目
    const first = await importSalesCsv(admin, luminaShopId, file(TWO_MONTHS), false);
    expect(first.ok).toBe(true);
    expect(await stats(luminaShopId, "2098-01")).toMatchObject({ count: 3, sum: 6000 });
    expect(await stats(luminaShopId, "2098-02")).toMatchObject({ count: 2, sum: 9000 });

    // 確認：2か月とも上書きになる
    const preview2 = await previewSalesCsv(admin, luminaShopId, file(TWO_MONTHS));
    expect(preview2.ok && preview2.overwriteMonths).toEqual(MONTHS);

    // 2回目（上書きの指定なし）：拒否されて何も変わらない
    const refused = await importSalesCsv(admin, luminaShopId, file(TWO_MONTHS), false);
    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.code).toBe("needsOverwrite");
      expect(refused.overwriteMonths).toEqual(MONTHS);
    }
    expect(await stats(luminaShopId, "2098-01")).toMatchObject({ count: 3, sum: 6000 });

    // 2回目（上書きの指定あり）：行数・合計・uploads の件数が1回目と同じ
    const second = await importSalesCsv(admin, luminaShopId, file(TWO_MONTHS), true);
    expect(second.ok).toBe(true);
    expect(await stats(luminaShopId, "2098-01")).toMatchObject({ count: 3, sum: 6000 });
    expect(await stats(luminaShopId, "2098-02")).toMatchObject({ count: 2, sum: 9000 });
    for (const month of MONTHS) expect(await uploadRows(luminaShopId, month)).toHaveLength(1);
  });

  it("同時に2回実行しても二重にならない（片方が止まってもよい）", async () => {
    await cleanupTestMonths();
    const results = await Promise.all([
      importSalesCsv(admin, luminaShopId, file(TWO_MONTHS), true),
      importSalesCsv(admin, luminaShopId, file(TWO_MONTHS), true),
    ]);
    expect(results.some((r) => r.ok)).toBe(true);
    for (const r of results) {
      if (!r.ok) expect(r.message).toMatch(/[ぁ-ん]/); // 止まった側も日本語のメッセージ
    }
    expect(await stats(luminaShopId, "2098-01")).toMatchObject({ count: 3, sum: 6000 });
    expect(await stats(luminaShopId, "2098-02")).toMatchObject({ count: 2, sum: 9000 });
    for (const month of MONTHS) expect(await uploadRows(luminaShopId, month)).toHaveLength(1);
  });
});

describe("上書きしたあと", () => {
  it("CSVに含まれる月だけ置き換わり、古い行は残らず、含まれない月は変わらない", async () => {
    await cleanupTestMonths();
    await importSalesCsv(admin, luminaShopId, file(TWO_MONTHS), false);

    // 1月だけの新しいCSV（SKU も金額も違う）で上書き
    const replaced = await importSalesCsv(admin, luminaShopId, file(csv(line("2098-01-10", "UP-NEW", 777, 111))), true);
    expect(replaced.ok).toBe(true);

    const jan = await stats(luminaShopId, "2098-01");
    expect(jan).toMatchObject({ count: 1, sum: 777 });
    expect(jan.skus).toEqual(["UP-NEW"]); // 古い UP-A〜C は残らない
    expect(await stats(luminaShopId, "2098-02")).toMatchObject({ count: 2, sum: 9000 }); // 2月は変わらない
  });
});

describe("別のお店", () => {
  it("別のお店の同じ月は『上書きになる月』に出ず、LUMINA の上書きの影響も受けない", async () => {
    await cleanupTestMonths();
    await importSalesCsv(admin, luminaShopId, file(TWO_MONTHS), false);

    // 別のお店から見ると、LUMINA の月は存在しない扱い（上書きの確認は出ない）
    const preview = await previewSalesCsv(other, otherShopId, file(csv(line("2098-01-05", "OT-1", 500, 100))));
    expect(preview.ok && preview.overwriteMonths).toEqual([]);

    const otherImport = await importSalesCsv(other, otherShopId, file(csv(line("2098-01-05", "OT-1", 500, 100))), false);
    expect(otherImport.ok).toBe(true);
    expect(await stats(otherShopId, "2098-01")).toMatchObject({ count: 1, sum: 500 });
    expect(await stats(luminaShopId, "2098-01")).toMatchObject({ count: 3, sum: 6000 }); // LUMINA は変わらない

    // LUMINA が上書きしても、別のお店の行は残る
    await importSalesCsv(admin, luminaShopId, file(TWO_MONTHS), true);
    expect(await stats(otherShopId, "2098-01")).toMatchObject({ count: 1, sum: 500, skus: ["OT-1"] });
    expect(await stats(luminaShopId, "2098-01")).toMatchObject({ count: 3, sum: 6000 });
  });
});

describe("権限", () => {
  it("操作者（operator）でも取り込め、管理者が入れた月を上書きできる", async () => {
    await cleanupTestMonths();
    await importSalesCsv(admin, luminaShopId, file(TWO_MONTHS), false);

    const refused = await importSalesCsv(operator, luminaShopId, file(TWO_MONTHS), false);
    expect(refused.ok).toBe(false); // 同じお店のデータなので、上書きの確認は操作者にも出る
    if (!refused.ok) expect(refused.code).toBe("needsOverwrite");

    const result = await importSalesCsv(operator, luminaShopId, file(csv(line("2098-01-20", "OP-1", 1234, 500))), true);
    expect(result.ok).toBe(true);
    expect(await stats(luminaShopId, "2098-01")).toMatchObject({ count: 1, sum: 1234, skus: ["OP-1"] });
  });

  it("休職・退職の人は取り込めず、データは変わらない。有効に戻すと取り込める", async () => {
    await cleanupTestMonths();
    await importSalesCsv(admin, luminaShopId, file(TWO_MONTHS), false);
    const setStatus = async (status: "active" | "leave" | "retired") => {
      const { error } = await service.from("profiles").update({ status }).eq("user_id", tempUserId);
      expect(error).toBeNull();
    };

    try {
      for (const status of ["leave", "retired"] as const) {
        await setStatus(status);
        const result = await importSalesCsv(operator, luminaShopId, file(csv(line("2098-01-21", "OP-2", 1, 1))), true);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.message).toMatch(/[ぁ-ん]/);
        expect(await stats(luminaShopId, "2098-01")).toMatchObject({ count: 3, sum: 6000 });
      }
    } finally {
      await setStatus("active");
    }
    const restored = await importSalesCsv(operator, luminaShopId, file(csv(line("2098-01-21", "OP-2", 1, 1))), true);
    expect(restored.ok).toBe(true);
  });

  it("未ログインは取り込めず、データは変わらない", async () => {
    await cleanupTestMonths();
    await importSalesCsv(admin, luminaShopId, file(TWO_MONTHS), false);

    const result = await importSalesCsv(createAnonClient(), luminaShopId, file(TWO_MONTHS), true);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/[ぁ-ん]/);
    expect(await stats(luminaShopId, "2098-01")).toMatchObject({ count: 3, sum: 6000 });
  });
});
