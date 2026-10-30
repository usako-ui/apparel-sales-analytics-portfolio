// T-39（AC-11）：スマホ・タブレットの幅で、ページ全体が横にずれないことの機械的な確認
// 各画面を 360／375／414／768 の幅に切り替えて、document の scrollWidth が画面の幅以内かを調べる。
// あわせて、各幅の画面を local-output/screenshots/00_今確認するもの/ に t39-画面名-w幅-sp.png で保存する（目で見る用）
// AI は呼ばない（「分析を生成」は押さない）。ログインは画面のグループごとに1回だけ（回数の上限を守るため）。
// 幅は自分で切り替えるので、sp プロジェクトだけで動かす（pc でも同じ結果になるため重複させない）
import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
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
} from "./support";
import { courseCsvSkipReason, hasCourseCsv } from "../helpers/course-csv";

const WIDTHS = [360, 375, 414, 768] as const;
const HEIGHT = 844;
const OUT_DIR = "local-output/screenshots/00_今確認するもの";

// ページ全体が画面の幅に収まっているか。はみ出していたら、はみ出した要素の名前を最大5件エラーに添える
async function expectNoHorizontalScroll(page: Page, label: string, width: number) {
  const result = await page.evaluate(() => {
    const doc = document.documentElement;
    const limit = window.innerWidth;
    const offenders = Array.from(document.body.querySelectorAll("*"))
      .filter((el) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.right > limit + 1;
      })
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.getAttribute("class") ?? "").slice(0, 60)}`);
    return { scrollWidth: doc.scrollWidth, limit, offenders };
  });
  expect(
    result.scrollWidth,
    `${label}（幅${width}）が横にずれています：scrollWidth=${result.scrollWidth}／画面=${result.limit}／はみ出した要素=${result.offenders.join(" | ")}`,
  ).toBeLessThanOrEqual(result.limit);
}

// 幅を順に切り替え、各幅で「ずれない」ことを確かめて、画面を保存する
// ready：その画面の準備ができたと言える目印（グラフの描画など）を待つ関数
async function checkAllWidths(page: Page, name: string, ready?: () => Promise<void>) {
  mkdirSync(OUT_DIR, { recursive: true });
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: HEIGHT });
    if (ready) await ready();
    // 幅の変更にグラフが追いつくのを待つ（Recharts は幅の変化を見て描き直す）
    await page.waitForTimeout(400);
    await page.mouse.move(0, 0);
    await expectNoHorizontalScroll(page, name, width);
    await page.screenshot({ path: `${OUT_DIR}/t39-${name}-w${width}-sp.png`, fullPage: true, caret: "initial" });
  }
}

test.beforeEach(({ browserName }, testInfo) => {
  test.skip(browserName !== "chromium" || testInfo.project.name !== "sp","幅は自分で切り替えるため、sp プロジェクトだけで実行する");
});

test("ログイン画面は、どの幅でも横にずれない", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator("h1")).toBeVisible();
  await checkAllWidths(page, "login");
});

test.describe("ログイン後の画面", () => {
  test.skip(!hasEnv, ".env.local がないため未実施");

  test("パスワード変更（初回）は、どの幅でも横にずれない", async ({ page }) => {
    const user = await createTempUser({ mustChangePassword: true });
    try {
      await loginAs(page, user.email, user.password);
      await expect(page.getByLabel("一時パスワード")).toBeVisible();
      await checkAllWidths(page, "password-first");
    } finally {
      await deleteTempUser(user.id);
    }
  });

  test("ダッシュボード・アップロード・パスワード変更は、どの幅でも横にずれない", async ({ page }) => {
    test.skip(!hasCourseCsv, courseCsvSkipReason);
    const user = await createTempUser({ role: "operator" });
    try {
      await loginAs(page, user.email, user.password);
      await expect(page.getByRole("heading", { name: "ダッシュボード", level: 1 })).toBeVisible();

      // 最新月：KPI・推移グラフ・カテゴリ別・売れ筋の表（全期間）
      await expect(page.locator(".recharts-bar-rectangle")).toHaveCount(4);
      await checkAllWidths(page, "dashboard", async () => {
        await expect(page.locator(".recharts-line-dot")).toHaveCount(6);
      });

      // 選択した月の表示
      await page.goto("/?month=2025-11&period=month");
      await expect(page.getByRole("region", { name: "カテゴリ別売上", exact: true })).toContainText("198,200");
      await checkAllWidths(page, "dashboard-month", async () => {
        await expect(page.locator(".recharts-bar-rectangle")).toHaveCount(4);
      });

      // アップロード：初期・取込結果（正常）・スキップ行あり
      await page.goto("/upload");
      await expect(page.getByRole("heading", { name: "CSVアップロード", level: 1 })).toBeVisible();
      await checkAllWidths(page, "upload-initial");
      await page.getByTestId("csv-file-input").setInputFiles("tests/fixtures/sample-sales.csv");
      await expect(page.getByTestId("result-counts")).toContainText("40行 成功");
      await checkAllWidths(page, "upload-preview");
      await page.getByTestId("csv-file-input").setInputFiles("tests/fixtures/invalid-rows.csv");
      await expect(page.getByTestId("result-counts")).toContainText("7行 スキップ");
      await checkAllWidths(page, "upload-preview-skipped");

      // パスワード変更（メニューから）
      await page.goto("/password");
      await expect(page.getByLabel("現在のパスワード")).toBeVisible();
      await checkAllWidths(page, "password-menu");
    } finally {
      await deleteTempUser(user.id);
    }
  });

  test("ダッシュボード（データ0件・AI分析コメント）は、どの幅でも横にずれない", async ({ page }) => {
    // 売上のない「空のお店」。0件の案内と、架空の月 2097-01〜02 の AI 分析の見本（本物の AI は呼ばない）
    const user = await createEmptyShopUser();
    try {
      await loginAs(page, user.email, user.password);
      await expect(page.getByRole("heading", { name: "売上データがまだありません" })).toBeVisible();
      await checkAllWidths(page, "empty");

      await seedShopMonths(user, [
        { month: "2097-01", report: { result: sampleAnalysisResult(false) } },
        { month: "2097-02", report: { result: sampleAnalysisResult(true) } },
        { month: "2097-03" },
      ]);
      const panel = page.getByRole("region", { name: "AI分析コメント", exact: true });
      await page.goto("/?month=2097-01");
      await expect(panel.getByText("AI生成・要確認")).toBeVisible();
      await checkAllWidths(page, "analysis-normal");

      await page.goto("/?month=2097-02");
      await expect(panel.getByText("数字を確認してください")).toBeVisible();
      await checkAllWidths(page, "analysis-warning");

      await page.goto("/?month=2097-03");
      await expect(panel.getByText("2097年3月の分析コメントは、まだありません")).toBeVisible();
      await checkAllWidths(page, "analysis-empty");
    } finally {
      await deleteShopUploads(user.shopId);
      await deleteEmptyShopUser(user);
    }
  });

  test("管理者画面とダイアログは、どの幅でも横にずれない", async ({ page }) => {
    // 長い名前の一時メンバーで、一覧がはみ出さないかを確かめる（終了時に消す）
    const longName = "確認用のとても長い名前の管理者メンバーさん（折り返しの確認）";
    const others = [
      await createTempUser({ role: "admin", displayName: longName }),
      await createTempUser({ role: "operator", displayName: "確認用の休職（折り返し）", status: "leave" }),
    ];
    try {
      await loginAs(page, adminEmail!, adminPassword!);
      await expect(page).toHaveURL(/\/$/);
      await page.goto("/admin");
      await expect(page.getByRole("heading", { name: "管理者", level: 1 })).toBeVisible();
      await expect(page.getByRole("button", { name: `${longName}さんの操作` })).toBeVisible();
      await checkAllWidths(page, "admin");

      // 操作メニューのダイアログ（画面の幅いっぱいの小さい画面でも収まるか）
      await page.getByRole("button", { name: `${longName}さんの操作` }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await checkAllWidths(page, "admin-dialog");
      await page.keyboard.press("Escape");
    } finally {
      for (const user of others) await deleteTempUser(user.id);
    }
  });
});
