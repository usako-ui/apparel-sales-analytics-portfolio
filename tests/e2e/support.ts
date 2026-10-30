// 画面確認（e2e・スクショ）の共通の道具。実際の検証用 Supabase につなぐ
// 状態を変える確認は、テスト専用の一時アカウント（@example.com・テスト後に必ず削除）で行う。
// TEST_* の既存アカウントの状態は変えない（ログインして画面を見るだけ）
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";

// .env.local の値をこのファイルの中だけに読み込む（値は出力しない）
try {
  process.loadEnvFile(".env.local");
} catch {
  // ファイルがなければ、各テストが skip する
}

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const adminEmail = process.env.TEST_ADMIN_EMAIL;
export const adminPassword = process.env.TEST_ADMIN_PASSWORD;
export const hasEnv = Boolean(supabaseUrl && serviceKey && adminEmail && adminPassword);

export const serviceClient = () =>
  createClient(supabaseUrl!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });

export type TempUserOptions = {
  role?: "admin" | "operator";
  status?: "active" | "leave" | "retired";
  mustChangePassword?: boolean;
  displayName?: string;
};

// 一時アカウントを作る。お店は LUMINA（テスト用管理者と同じお店）
export async function createTempUser(options: TempUserOptions = {}) {
  const client = serviceClient();
  const email = `e2e-${randomUUID()}@example.com`;
  const password = `${randomBytes(12).toString("hex")}Aa1`;
  const { data, error } = await client.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error("一時アカウントの作成に失敗しました");
  const { data: adminUsers } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const adminId = adminUsers?.users.find((u) => u.email === adminEmail)?.id;
  const { data: adminProfile } = await client.from("profiles").select("shop_id").eq("user_id", adminId!).single();
  const { error: profileError } = await client.from("profiles").insert({
    user_id: data.user.id,
    shop_id: adminProfile!.shop_id,
    display_name: options.displayName ?? "画面確認の一時アカウント",
    role: options.role ?? "operator",
    status: options.status ?? "active",
    must_change_password: options.mustChangePassword ?? false,
  });
  if (profileError) throw new Error("一時アカウントの profiles 作成に失敗しました");
  return { id: data.user.id, email, password };
}

// 売上データが1件もない「空のお店」と、そのお店の一時アカウントを作る（データ0件の画面の確認用）。
// LUMINA には触れない。終わったら deleteEmptyShopUser で、アカウント → お店の順に消す
// options（省略可）：納品ドキュメント用のスクショで、架空のお店の名前・氏名・メール・ロールにするための指定
export type EmptyShopOptions = { shopName?: string; displayName?: string; email?: string; role?: "admin" | "operator" };

export async function createEmptyShopUser(options: EmptyShopOptions = {}) {
  const client = serviceClient();
  const { data: shop, error: shopError } = await client
    .from("shops")
    .insert({ name: options.shopName ?? `e2e-空のお店-${randomUUID()}` })
    .select("id")
    .single();
  if (shopError || !shop) throw new Error("空のお店の作成に失敗しました");

  const email = options.email ?? `e2e-${randomUUID()}@example.com`;
  const password = `${randomBytes(12).toString("hex")}Aa1`;
  const { data, error } = await client.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) {
    await client.from("shops").delete().eq("id", shop.id);
    throw new Error("一時アカウントの作成に失敗しました");
  }
  const { error: profileError } = await client.from("profiles").insert({
    user_id: data.user.id,
    shop_id: shop.id,
    display_name: options.displayName ?? "空のお店の一時アカウント",
    role: options.role ?? "operator",
    status: "active",
    must_change_password: false,
  });
  if (profileError) {
    await client.auth.admin.deleteUser(data.user.id);
    await client.from("shops").delete().eq("id", shop.id);
    throw new Error("一時アカウントの profiles 作成に失敗しました");
  }
  return { id: data.user.id, shopId: shop.id, email, password };
}

// 指定のお店に、メンバーを1人足す（管理者画面の一覧の見本用）。片付けは deleteTempUser(id)（お店ごと消す前に行う）
export async function createShopMember(
  shopId: string,
  options: { displayName: string; email: string; role: "admin" | "operator"; status?: "active" | "leave" | "retired" },
) {
  const client = serviceClient();
  const password = `${randomBytes(12).toString("hex")}Aa1`;
  const { data, error } = await client.auth.admin.createUser({ email: options.email, password, email_confirm: true });
  if (error || !data.user) throw new Error("メンバーの作成に失敗しました");
  const { error: profileError } = await client.from("profiles").insert({
    user_id: data.user.id,
    shop_id: shopId,
    display_name: options.displayName,
    role: options.role,
    status: options.status ?? "active",
    must_change_password: false,
  });
  if (profileError) {
    await client.auth.admin.deleteUser(data.user.id);
    throw new Error("メンバーの profiles 作成に失敗しました");
  }
  return { id: data.user.id, email: options.email, password };
}

// 作った一時アカウントの組（email と、ログイン用の値）でログインする
export async function loginWith(page: Page, user: { email: string; password: string }) {
  await loginAs(page, user.email, user.password);
}

export async function deleteEmptyShopUser(user: { id: string; shopId: string }) {
  const client = serviceClient();
  await client.auth.admin.deleteUser(user.id); // profiles は一緒に消える（最後の1人の削除は許される）
  await client.from("shops").delete().eq("id", user.shopId);
}

// AI分析の見本の中身：tests/fixtures/llm/valid.json に、数字の照合の結果（numberWarnings）を足した形。
// withWarnings=true なら、一致しなかった数値が2件ある見本
export function sampleAnalysisResult(withWarnings: boolean) {
  const valid = JSON.parse(readFileSync("tests/fixtures/llm/valid.json", "utf8"));
  return {
    ...valid,
    numberWarnings: withWarnings
      ? [
          { kind: "amount", text: "約30万円", field: "summary" },
          { kind: "percent", text: "+12.3%", field: "highlights[1]" },
        ]
      : [],
  };
}

// 「空のお店」に、架空の月の売上（各月1行）と、AI分析の見本（reports）を入れる（AIコメントの表示の確認用）。
// 本物の AI は呼ばない。reports は update の権限がないので、差し替えは削除してから入れ直す。
// uploads・sales_data・reports のお店は、必ず同じ shopId にそろえる（service role は RLS を通らないため自分で保つ）
export type SeedMonth = {
  month: string; // YYYY-MM（架空の月 2097-xx）
  report?: { result: unknown; provider?: "claude" | "gemini"; generatedAt?: string };
};

export async function seedShopMonths(user: { id: string; shopId: string }, months: SeedMonth[]) {
  const client = serviceClient();
  const batchId = randomUUID();
  for (const { month, report } of months) {
    const { data: upload, error: uploadError } = await client
      .from("uploads")
      .insert({
        shop_id: user.shopId,
        user_id: user.id,
        batch_id: batchId,
        filename: `e2e-${month}.csv`,
        target_month: month,
        row_count: 1,
      })
      .select("id")
      .single();
    if (uploadError || !upload) throw new Error("見本の uploads の作成に失敗しました");

    const { error: salesError } = await client.from("sales_data").insert({
      upload_id: upload.id,
      shop_id: user.shopId,
      order_date: `${month}-05`,
      customer_id: "e2e-customer",
      product_name: "画面確認の商品",
      category: "テスト",
      sku: `E2E-${month}`,
      quantity: 1,
      revenue: 10000,
      cost: 4000,
    });
    if (salesError) throw new Error("見本の sales_data の作成に失敗しました");

    if (report) {
      const warnings = (report.result as { numberWarnings?: unknown[] }).numberWarnings ?? [];
      const { error: reportError } = await client.from("reports").insert({
        upload_id: upload.id,
        shop_id: user.shopId,
        target_month: month,
        result: report.result,
        llm_provider: report.provider ?? "gemini",
        has_number_warning: warnings.length > 0,
        generated_at: report.generatedAt ?? "2026-10-27T05:05:00+00:00",
      });
      if (reportError) throw new Error("見本の reports の作成に失敗しました");
    }
  }
}

// 見本の片付け：uploads を消す（sales_data・reports は CASCADE）。アカウント（uploads.user_id が結ぶ）を消す前に行う
export async function deleteShopUploads(shopId: string) {
  const { error } = await serviceClient().from("uploads").delete().eq("shop_id", shopId);
  // throw にしない：投げると続くアカウント・お店の削除が飛び、片付け漏れが増えるため。ここで原因を明示して続行する
  if (error) console.error(`見本の片付けに失敗しました（お店 ${shopId} の uploads を削除できませんでした）。手で確認してください`);
}

// 一時アカウントを消す（追加画面で作ったアカウントも、メールの前置き e2e- で探して消せるよう deleteTempUsersByPrefix を用意）
export async function deleteTempUser(id: string) {
  await serviceClient().auth.admin.deleteUser(id);
}

// 画面の操作で作ったテスト用アカウント（メールが指定の前置き＋ @example.com）をまとめて消す
export async function deleteTempUsersByPrefix(prefix: string) {
  const client = serviceClient();
  const { data } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
  for (const user of data?.users ?? []) {
    const email = user.email ?? "";
    if (email.startsWith(prefix) && email.endsWith("@example.com")) await client.auth.admin.deleteUser(user.id);
  }
}

export async function loginAs(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード").fill(password);
  await page.getByRole("button", { name: "ログイン" }).click();
}
