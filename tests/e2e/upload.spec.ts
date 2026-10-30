// CSVアップロード画面（/upload）の画面確認（T-15・AC-01 の画面部分）。実際の検証用 Supabase につなぐ
//
// DB の扱い（取り込みまで行うテストだけ DB に書く）：
//   ・確認（preview）だけのテストは DB に書かない（配布CSV・不正行CSV・5MB超・形式違い）
//   ・取り込むテストは、本物の月（2025-09〜11）には触れず、架空の月 2097-01・2097-02 だけのCSVをその場で作って使う
//     （integration の 2098 とも重ならない）。取り込むのは、テスト専用の一時アカウント（@example.com）
//   ・片付け：その一時アカウントが作った uploads を消してから（sales_data は CASCADE で一緒に消える）、アカウントを消す
//     （uploads.user_id はアカウントの削除では消えない決まりのため、先に uploads を消さないとアカウントが残る）
//     始める前にも、架空の月 2097-xx の uploads を消す（前回の失敗で残った分の掃除）
import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { createTempUser, deleteTempUser, hasEnv, loginAs, serviceClient } from "./support";
import { courseCsvSkipReason, hasCourseCsv } from "../helpers/course-csv";

const FIXTURES = "tests/fixtures";
const FAKE_MONTHS = ["2097-01", "2097-02"];

const fileInput = (page: Page) => page.getByTestId("csv-file-input");

async function openUploadAs(page: Page, user: { email: string; password: string }) {
  await loginAs(page, user.email, user.password);
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/upload");
  await expect(page.getByRole("heading", { name: "CSVアップロード", level: 1 })).toBeVisible();
}

// 一時アカウントの後片付け（uploads → アカウントの順）
async function removeTempUserWithUploads(userId: string) {
  await serviceClient().from("uploads").delete().eq("user_id", userId);
  await deleteTempUser(userId);
}

test.describe("CSVアップロード画面（検証用 Supabase）", () => {
  test.skip(!hasEnv, ".env.local がないため未実施");
  // ログインの回数の上限（429）を避けるため、1つずつ順に実行する
  test.describe.configure({ mode: "serial" });

  test("確認だけ（DBには書かない）：配布CSV・不正行・5MB超・形式違い", async ({ page }) => {
    test.skip(!hasCourseCsv, courseCsvSkipReason);
    // 操作者でも使える画面（管理者でなくてよい）
    const user = await createTempUser({ role: "operator" });
    try {
      await openUploadAs(page, user);

      // 5MB を超えるファイル・.csv 以外は、サーバーへ送らずに日本語のメッセージが出る
      let actionCalls = 0;
      page.on("request", (request) => {
        if (request.method() === "POST" && request.headers()["next-action"]) actionCalls += 1;
      });
      await fileInput(page).setInputFiles({
        name: "too-big.csv",
        mimeType: "text/csv",
        buffer: Buffer.alloc(5 * 1024 * 1024 + 1, "a"),
      });
      await expect(page.getByRole("alert").filter({ hasText: "ファイルが大きすぎます" })).toContainText("上限は5MBです");
      await fileInput(page).setInputFiles({ name: "sales.xlsx", mimeType: "application/octet-stream", buffer: Buffer.from("x") });
      await expect(page.getByRole("alert").filter({ hasText: "CSVファイル（.csv）を選んでください" })).toBeVisible();
      expect(actionCalls).toBe(0);

      // AC-01（画面）：配布CSVは「40行 成功 / 0行 スキップ」。スキップがないのでダウンロードは出ない
      await fileInput(page).setInputFiles(`${FIXTURES}/sample-sales.csv`);
      const counts = page.getByTestId("result-counts");
      await expect(counts).toContainText("40行 成功");
      await expect(counts).toContainText("0行 スキップ");
      await expect(page.getByTestId("result-file-name")).toHaveText("sample-sales.csv");
      await expect(page.getByTestId("result-months")).toContainText("2025年9月");
      await expect(page.getByTestId("result-months")).toContainText("2025年11月");
      await expect(page.getByRole("button", { name: "スキップ行をダウンロード" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "取り込む" })).toBeVisible();
      // 前の問題のメッセージは、選び直すと消える
      await expect(page.getByRole("alert").filter({ hasText: "5MB" })).toHaveCount(0);

      // 不正行入り：2行 成功 / 7行 スキップ。スキップ行のCSVをダウンロードできる（日本語の名前・理由の列つき）
      await fileInput(page).setInputFiles(`${FIXTURES}/invalid-rows.csv`);
      await expect(counts).toContainText("2行 成功");
      await expect(counts).toContainText("7行 スキップ");
      const downloadPromise = page.waitForEvent("download");
      await page.getByRole("button", { name: "スキップ行をダウンロード" }).click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBe("invalid-rows_スキップ行.csv");
      const text = await readFile(await download.path(), "utf8");
      expect(text).toContain("行番号");
      expect(text).toContain("日付が読めません");

      // 必須列がないCSV：停止（足りない列名が日本語で出る）。取り込むボタンは出ない
      await fileInput(page).setInputFiles(`${FIXTURES}/missing-columns.csv`);
      await expect(page.getByRole("alert").filter({ hasText: "列" })).toBeVisible();
      await expect(page.getByRole("button", { name: "取り込む" })).toHaveCount(0);
    } finally {
      await removeTempUserWithUploads(user.id);
    }
  });

  // T-27 No.3：確認の後でログインが切れた（Cookie が消えた）状態で「取り込む」・ファイルの選び直しをした時、
  // 「通信に失敗しました」ではなく、ログイン切れと分かる案内（ログイン画面へのリンクつき）が出る。DB には何も書かれない
  test("ログインが切れた後の確認・取り込みは、ログインし直す案内が出る", async ({ page }) => {
    test.skip(!hasCourseCsv, courseCsvSkipReason);
    const user = await createTempUser({ role: "operator" });
    try {
      await openUploadAs(page, user);
      await fileInput(page).setInputFiles(`${FIXTURES}/sample-sales.csv`);
      await expect(page.getByTestId("result-counts")).toContainText("40行 成功");

      // ログイン切れ：Cookie を消す（サーバー側のセッションが無い状態）。取り込むを押す
      await page.context().clearCookies();
      await page.getByRole("button", { name: "取り込む" }).click();
      const expired = page.getByRole("alert").filter({ hasText: "ログインの有効期限が切れました" });
      await expect(expired).toHaveText("ログインの有効期限が切れました。もう一度ログインしてください。");
      await expect(page.getByRole("link", { name: "ログイン画面へ" })).toHaveAttribute("href", "/login");
      await expect(page.getByText("通信に失敗しました")).toHaveCount(0);
      // 取り込みは行われていない（成功の知らせが出ない）
      await expect(page.getByText("を取り込みました")).toHaveCount(0);

      // ファイルの選び直し（確認）でも同じ
      await fileInput(page).setInputFiles(`${FIXTURES}/invalid-rows.csv`);
      await expect(page.getByRole("alert").filter({ hasText: "ログインの有効期限が切れました" })).toBeVisible();
      await expect(page.getByText("通信に失敗しました")).toHaveCount(0);

      // リンクからログイン画面へ戻れる
      await page.getByRole("link", { name: "ログイン画面へ" }).click();
      await expect(page).toHaveURL(/\/login$/);
    } finally {
      await removeTempUserWithUploads(user.id);
    }
  });

  test("取り込み → 上書きの確認（上書きしない／上書きする）→ ダッシュボードへのリンク", async ({ page }) => {
    const client = serviceClient();
    await client.from("uploads").delete().in("target_month", FAKE_MONTHS);

    const header = "order_date,customer_id,product_name,category,sku,quantity,revenue,cost";
    const csv = [
      header,
      "2097-01-05,c1,画面確認の商品,テスト,E2E-A,1,1000,400",
      "2097-01-06,c2,画面確認の商品,テスト,E2E-B,2,2000,900",
      "2097-02-07,c1,画面確認の商品,テスト,E2E-C,1,3000,1000",
    ].join("\n");
    const upload = { name: "e2e-upload.csv", mimeType: "text/csv", buffer: Buffer.from(csv) };

    const user = await createTempUser({ role: "operator" });
    const uploadIds = async () => {
      const { data } = await client.from("uploads").select("id").eq("user_id", user.id).in("target_month", FAKE_MONTHS);
      return (data ?? []).map((row) => row.id as string).sort();
    };

    try {
      await openUploadAs(page, user);

      // 確認：保存はまだ（DBに何もない）
      await fileInput(page).setInputFiles(upload);
      await expect(page.getByTestId("result-counts")).toContainText("3行 成功");
      expect(await uploadIds()).toHaveLength(0);

      // 取り込む → 成功の知らせとダッシュボードへのリンク。月ごとに uploads が1行ずつ
      await page.getByRole("button", { name: "取り込む" }).click();
      await expect(page.getByRole("status").filter({ hasText: "3行を取り込みました" })).toBeVisible();
      await expect(page.getByRole("link", { name: "ダッシュボードを見る" })).toHaveAttribute("href", "/");
      const firstIds = await uploadIds();
      expect(firstIds).toHaveLength(2);

      // 同じファイルをもう一度：すでにある月の印 → 取り込む → 確認ダイアログ。「上書きしない」は何も取り込まない
      await fileInput(page).setInputFiles(upload);
      await expect(page.getByTestId("result-months")).toContainText("すでにデータあり");
      await page.getByRole("button", { name: "取り込む" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(dialog.getByTestId("overwrite-months")).toHaveText("2097年1月、2097年2月");
      await dialog.getByRole("button", { name: "上書きしない" }).click();
      await expect(dialog).toHaveCount(0);
      await expect(page.getByText("を取り込みました")).toHaveCount(0);
      expect(await uploadIds()).toEqual(firstIds);

      // もう一度 → 「上書きする」で置き換わる（古い uploads は消え、新しい2行になる）
      await page.getByRole("button", { name: "取り込む" }).click();
      await dialog.getByRole("button", { name: "上書きする" }).click();
      await expect(page.getByRole("status").filter({ hasText: "上書きしました" })).toContainText("2097年1月、2097年2月");
      const secondIds = await uploadIds();
      expect(secondIds).toHaveLength(2);
      expect(secondIds.some((id) => firstIds.includes(id))).toBe(false);
    } finally {
      await removeTempUserWithUploads(user.id);
      await client.from("uploads").delete().in("target_month", FAKE_MONTHS);
    }
  });
});
