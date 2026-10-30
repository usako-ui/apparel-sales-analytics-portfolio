// npm run screenshot：各画面を PC（1280幅）・スマホ（390幅）で撮り、local-output/screenshots/00_今確認するもの/ に保存する
// 一時パスワードなどが写る画像は、名前の先頭を secret- にする（docs/ に移さない目印。振り分けは move-shots.mjs）
// 画面が増えたら、ここに1件ずつ足す。ログインが必要な画面は、テスト専用の一時アカウント（@example.com）を
// 作って撮り、終わったら必ず消す（TEST_* の既存アカウントの状態は変えない）
import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import type { Page, TestInfo } from "@playwright/test";
import {
  adminEmail,
  adminPassword,
  createEmptyShopUser,
  createTempUser,
  deleteEmptyShopUser,
  deleteShopUploads,
  deleteTempUser,
  hasEnv,
  loginAs,
  sampleAnalysisResult,
  seedShopMonths,
  serviceClient,
} from "./support";
import { courseCsvSkipReason, hasCourseCsv } from "../helpers/course-csv";

const OUT_DIR = "local-output/screenshots/00_今確認するもの";

const shot = async (page: Page, testInfo: TestInfo, name: string, fullPage = false) => {
  // フォルダがなければ作る（PC・スマホが同時に動いても、既にあればそのまま）
  mkdirSync(OUT_DIR, { recursive: true });
  // caret: "initial"：撮る時に入力欄へ style（caret-color）を足さない。足すと、画面の準備前に撮った時、
  // 開発サーバーが「サーバーの HTML と合わない」と警告し、画像に赤い「1 Issue」が写り込む（アプリの不具合ではない）
  await page.screenshot({ path: `${OUT_DIR}/${name}-${testInfo.project.name}.png`, fullPage, caret: "initial" });
};

test("login @screenshot", async ({ page }, testInfo) => {
  await page.goto("/login");
  await expect(page.locator("h1")).toBeVisible();
  await shot(page, testInfo, "login", true);
});

test.describe("ログイン後の画面 @screenshot", () => {
  test.skip(!hasEnv, ".env.local がないため未実施");

  test("パスワード変更（初回・一時パスワード） @screenshot", async ({ page }, testInfo) => {
    const user = await createTempUser({ mustChangePassword: true });
    try {
      await loginAs(page, user.email, user.password);
      await expect(page).toHaveURL(/\/password$/);
      await expect(page.getByLabel("一時パスワード")).toBeVisible();
      await shot(page, testInfo, "password-first", true);
    } finally {
      await deleteTempUser(user.id);
    }
  });

  test("パスワード変更（メニューから）と操作者のメニュー @screenshot", async ({ page }, testInfo) => {
    const user = await createTempUser({ role: "operator" });
    try {
      await loginAs(page, user.email, user.password);
      await expect(page.getByRole("heading", { name: "ダッシュボード", level: 1 })).toBeVisible();
      await shot(page, testInfo, "menu-operator");
      await page.getByRole("link", { name: /パスワード変更|アカウント/ }).click();
      await expect(page).toHaveURL(/\/password$/);
      await expect(page.getByLabel("現在のパスワード")).toBeVisible();
      await shot(page, testInfo, "password-menu", true);
    } finally {
      await deleteTempUser(user.id);
    }
  });

  // T-21・22・23：ダッシュボード。開発用 DB の LUMINA（2025-09〜11）を読むだけで、書き込み・削除はしない
  // dashboard-top＝2025-11（前月比の緑・推移グラフ）／dashboard-month-09＝2025-09（前月がなく「—」と理由が出る月）
  test("ダッシュボード（最新月・前月のない月） @screenshot", async ({ page }, testInfo) => {
    const user = await createTempUser({ role: "operator" });
    try {
      await loginAs(page, user.email, user.password);
      await expect(page.getByRole("heading", { name: "ダッシュボード", level: 1 })).toBeVisible();
      // 最新月（2025年11月）の売上の正解値（264,700円）と、グラフの描画（点6つ）が出るまで待ってから撮る
      await expect(page.getByRole("region", { name: "売上", exact: true })).toContainText("264,700");
      await expect(page.locator(".recharts-line-dot")).toHaveCount(6);
      await page.mouse.move(0, 0); // マウスの位置にグラフの吹き出しが写り込まないよう、端へ逃がす
      await shot(page, testInfo, "dashboard-top", true);

      await page.goto("/?month=2025-09");
      await expect(page.getByRole("region", { name: "売上", exact: true })).toContainText("148,400");
      await expect(page.getByRole("region", { name: "売上", exact: true })).toContainText("前月のデータがありません");
      await expect(page.locator(".recharts-line-dot")).toHaveCount(6);
      await page.mouse.move(0, 0);
      await shot(page, testInfo, "dashboard-month-09", true);
    } finally {
      await deleteTempUser(user.id);
    }
  });

  // T-25：カテゴリ別売上・売れ筋トップ10。dashboard-all＝全期間／dashboard-month-11＝選択した月（2025-11）
  test("ダッシュボード（カテゴリ別・売れ筋：全期間と選択した月） @screenshot", async ({ page }, testInfo) => {
    const user = await createTempUser({ role: "operator" });
    try {
      await loginAs(page, user.email, user.password);
      await expect(page.getByRole("heading", { name: "ダッシュボード", level: 1 })).toBeVisible();
      await expect(page.locator(".recharts-bar-rectangle")).toHaveCount(4);
      await expect(page.getByRole("region", { name: "カテゴリ別売上", exact: true })).toContainText("287,400");
      await page.mouse.move(0, 0);
      await shot(page, testInfo, "dashboard-all", true);

      await page.goto("/?month=2025-11&period=month");
      await expect(page.getByRole("region", { name: "カテゴリ別売上", exact: true })).toContainText("198,200");
      await expect(page.locator(".recharts-bar-rectangle")).toHaveCount(4);
      await page.mouse.move(0, 0);
      await shot(page, testInfo, "dashboard-month-11", true);
    } finally {
      await deleteTempUser(user.id);
    }
  });

  // 共通レイアウト：ダッシュボードを下までスクロールした「その時の画面」（フルページではない）。左メニューが画面いっぱいに固定されていることの確認用
  test("ダッシュボード（下までスクロールした画面） @screenshot", async ({ page }, testInfo) => {
    const user = await createTempUser({ role: "operator" });
    try {
      await loginAs(page, user.email, user.password);
      await expect(page.getByRole("heading", { name: "ダッシュボード", level: 1 })).toBeVisible();
      await expect(page.locator(".recharts-bar-rectangle")).toHaveCount(4);
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(200);
      await page.mouse.move(0, 0);
      await shot(page, testInfo, "dashboard-scrolled"); // fullPage にしない
    } finally {
      await deleteTempUser(user.id);
    }
  });

  // T-34・35：AI分析コメント。「分析を生成」は押さない（本物の AI に届くため）。
  // 売上のない「空のお店」に架空の月 2097-01〜03 と AI分析の見本を入れて撮る（LUMINA には触れない。終了時にお店ごと消す）
  // analysis-normal＝正常／analysis-warning＝数字の警告あり／analysis-empty＝まだ生成していない（この3枚は区画だけ）／analysis-page＝正常の月のページ全体
  test("ダッシュボード（AI分析コメント：正常・警告あり・未生成） @screenshot", async ({ page }, testInfo) => {
    const user = await createEmptyShopUser();
    try {
      await seedShopMonths(user, [
        { month: "2097-01", report: { result: sampleAnalysisResult(false) } },
        { month: "2097-02", report: { result: sampleAnalysisResult(true) } },
        { month: "2097-03" },
      ]);
      await loginAs(page, user.email, user.password);
      await expect(page.getByRole("heading", { name: "ダッシュボード", level: 1 })).toBeVisible();
      const panel = page.getByRole("region", { name: "AI分析コメント", exact: true });
      const shootPanel = async (name: string) => {
        mkdirSync(OUT_DIR, { recursive: true });
        // 区画の要素だけの撮影は、背の高い区画で下が画面の下のタブに隠れるため、ページ全体の撮影から区画の範囲だけを切り出す
        const clip = await panel.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y + window.scrollY, width: r.width, height: r.height };
        });
        await page.screenshot({ path: `${OUT_DIR}/${name}-${testInfo.project.name}.png`, fullPage: true, clip, caret: "initial" });
      };

      // 未生成（最新月 2097-03）
      await expect(panel.getByText("2097年3月の分析コメントは、まだありません")).toBeVisible();
      await page.mouse.move(0, 0);
      await shootPanel("analysis-empty");

      // 正常（2097-01）
      await page.goto("/?month=2097-01");
      await expect(panel.getByText("AI生成・要確認")).toBeVisible();
      await expect(page.locator(".recharts-line-dot")).toHaveCount(6); // 3か月×2本の線
      await page.mouse.move(0, 0);
      await shootPanel("analysis-normal");
      await shot(page, testInfo, "analysis-page", true);

      // 数字の警告あり（2097-02）
      await page.goto("/?month=2097-02");
      await expect(panel.getByText("数字を確認してください")).toBeVisible();
      await page.mouse.move(0, 0);
      await shootPanel("analysis-warning");
    } finally {
      await deleteShopUploads(user.shopId);
      await deleteEmptyShopUser(user);
    }
  });

  // T-23：データ0件。売上データのない「空のお店」の一時アカウント（LUMINA には触れない。終了時にお店ごと消す）
  test("ダッシュボード（データ0件） @screenshot", async ({ page }, testInfo) => {
    const user = await createEmptyShopUser();
    try {
      await loginAs(page, user.email, user.password);
      await expect(page.getByRole("heading", { name: "売上データがまだありません" })).toBeVisible();
      await shot(page, testInfo, "dashboard-empty", true);
    } finally {
      await deleteEmptyShopUser(user);
    }
  });

  // T-15：CSVアップロード。確認（preview）までで、DB には書かない
  test("CSVアップロード（初期表示・確認の結果） @screenshot", async ({ page }, testInfo) => {
    test.skip(!hasCourseCsv, courseCsvSkipReason);
    const user = await createTempUser({ role: "operator" });
    try {
      await loginAs(page, user.email, user.password);
      await expect(page).toHaveURL(/\/$/);
      await page.goto("/upload");
      await expect(page.getByRole("heading", { name: "CSVアップロード", level: 1 })).toBeVisible();
      await shot(page, testInfo, "upload-initial", true);

      // 配布CSV：40行 成功 / 0行 スキップ
      await page.getByTestId("csv-file-input").setInputFiles("tests/fixtures/sample-sales.csv");
      await expect(page.getByTestId("result-counts")).toContainText("40行 成功");
      await shot(page, testInfo, "upload-preview", true);

      // 不正行入り：スキップ行のダウンロードが出る
      await page.getByTestId("csv-file-input").setInputFiles("tests/fixtures/invalid-rows.csv");
      await expect(page.getByTestId("result-counts")).toContainText("7行 スキップ");
      await shot(page, testInfo, "upload-preview-skipped", true);
    } finally {
      await deleteTempUser(user.id);
    }
  });

  // T-15：上書き確認ダイアログ。本物の月（2025-09〜11）には触れず、架空の月 2097-01・02 を一時アカウントで取り込む。
  // 片付け：その一時アカウントの uploads を消してから（sales_data は CASCADE）アカウントを消す。開始前にも 2097 の月を掃除する
  test("CSVアップロード（上書きの確認ダイアログ） @screenshot", async ({ page }, testInfo) => {
    const client = serviceClient();
    const fakeMonths = ["2097-01", "2097-02"];
    await client.from("uploads").delete().in("target_month", fakeMonths);
    const csv = [
      "order_date,customer_id,product_name,category,sku,quantity,revenue,cost",
      "2097-01-05,c1,画面確認の商品,テスト,SHOT-A,1,1000,400",
      "2097-02-07,c1,画面確認の商品,テスト,SHOT-B,1,3000,1000",
    ].join("\n");
    const file = { name: "sales-2097.csv", mimeType: "text/csv", buffer: Buffer.from(csv) };
    const user = await createTempUser({ role: "operator" });
    try {
      await loginAs(page, user.email, user.password);
      await expect(page).toHaveURL(/\/$/);
      await page.goto("/upload");
      await expect(page.getByRole("heading", { name: "CSVアップロード", level: 1 })).toBeVisible();
      // 画面の準備（ハイドレーション）前に選ぶと無視されるため、結果が出るまで選び直す
      await expect(async () => {
        await page.getByTestId("csv-file-input").setInputFiles(file);
        await expect(page.getByTestId("result-counts")).toContainText("2行 成功", { timeout: 3000 });
      }).toPass({ timeout: 20_000 });
      await page.getByRole("button", { name: "取り込む" }).click();
      await expect(page.getByRole("status").filter({ hasText: "2行を取り込みました" })).toBeVisible();

      await page.getByTestId("csv-file-input").setInputFiles(file);
      await expect(page.getByTestId("result-months")).toContainText("すでにデータあり");
      await page.getByRole("button", { name: "取り込む" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await shot(page, testInfo, "upload-overwrite-dialog");
    } finally {
      await client.from("uploads").delete().eq("user_id", user.id);
      await deleteTempUser(user.id);
      await client.from("uploads").delete().in("target_month", fakeMonths);
    }
  });

  test("管理者画面と各ダイアログ @screenshot", async ({ page }, testInfo) => {
    // 見た目を確かめるための一時メンバー（終了時に消す）
    // PC とスマホは同時に動くため、名前に project 名を付けて、お互いの一時メンバーと取り違えないようにする
    const p = testInfo.project.name;
    const names = { admin: `確認用の管理者-${p}`, leave: `確認用の休職-${p}`, retired: `確認用の退職-${p}` };
    const others = [
      await createTempUser({ role: "admin", displayName: names.admin }),
      await createTempUser({ role: "operator", displayName: names.leave, status: "leave" }),
      await createTempUser({ role: "operator", displayName: names.retired, status: "retired" }),
    ];
    try {
      await loginAs(page, adminEmail!, adminPassword!);
      await expect(page).toHaveURL(/\/$/);
      await page.goto("/admin");
      await expect(page.getByRole("heading", { name: "管理者", level: 1 })).toBeVisible();
      await expect(page.getByRole("button", { name: `${names.admin}さんの操作` })).toBeVisible();
      await shot(page, testInfo, "admin", true);

      const open = (name: string) =>
        page.getByRole("button", { name: `${name}さんの操作` }).click();
      const dialog = page.getByRole("dialog");

      // 自分の行：編集だけ
      const self = page.locator("tr, li").filter({ hasText: "（あなた）" }).filter({ has: page.getByRole("button", { name: /さんの操作/ }) });
      await self.getByRole("button", { name: /さんの操作/ }).click();
      await shot(page, testInfo, "admin-menu-self");
      await page.keyboard.press("Escape");

      // 退職の人：状態は「有効」だけ。一時パスワードも再発行される旨
      await open(names.retired);
      await dialog.getByRole("button", { name: "状態を変更" }).click();
      await expect(dialog.getByText("一時パスワードも再発行されます")).toBeVisible();
      await shot(page, testInfo, "admin-status-retired");
      await page.keyboard.press("Escape");

      // 再発行：確認 → 一時パスワード（1回だけ表示）
      await open(names.admin);
      await dialog.getByRole("button", { name: "一時パスワードを再発行" }).click();
      await shot(page, testInfo, "admin-reissue-confirm");
      await dialog.getByRole("button", { name: "再発行する" }).click();
      await expect(dialog.getByTestId("temporary-password")).toBeVisible();
      await shot(page, testInfo, "secret-admin-temp-password");
      await dialog.getByRole("button", { name: "閉じる", exact: true }).click();
    } finally {
      for (const user of others) await deleteTempUser(user.id);
    }
  });
});
