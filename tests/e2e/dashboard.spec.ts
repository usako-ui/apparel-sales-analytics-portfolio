// T-22：KPIカード（前月比の色分け・「—」と理由）と、表示する月の選択（AC-04・05 の画面部分）
// 開発用 DB の LUMINA（配布CSV 2025-09〜11）を読むだけ。書き込み・削除はしない（一時アカウントでログインして見る）
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { createEmptyShopUser, createTempUser, deleteEmptyShopUser, deleteTempUser, hasEnv, loginAs } from "./support";

const card = (page: Page, name: string) => page.getByRole("region", { name, exact: true });

test.describe("ダッシュボードのKPIカード（検証用 Supabase）", () => {
  test.skip(!hasEnv, ".env.local がないため未実施");
  // ログイン回数の上限があるため、1人のログインで全部の確認をまとめる
  test.describe.configure({ mode: "serial" });

  test("最新月の正解値・前月比の色・月の選択・「—」と理由・不正な月", async ({ page }) => {
    const user = await createTempUser({ role: "operator" });
    try {
      await loginAs(page, user.email, user.password);
      await expect(page.getByRole("heading", { name: "ダッシュボード", level: 1 })).toBeVisible();

      // AC-04・05：初期表示は最新月（2025年11月）。売上264,700円・粗利163,100円・売上の前月比＋79.5%（増加＝緑）
      const select = page.getByRole("combobox", { name: "表示する月" });
      await expect(select).toHaveValue("2025-11");
      await expect(card(page, "売上")).toContainText("264,700");
      const revenueChange = card(page, "売上").getByText("+79.5%");
      await expect(revenueChange).toBeVisible();
      await expect(revenueChange).toHaveClass(/text-up/);
      await expect(card(page, "粗利")).toContainText("163,100");
      await expect(card(page, "リピート率")).toContainText("46.7");
      await expect(card(page, "リピート率").getByText("+8.2pt")).toHaveClass(/text-up/);
      await expect(card(page, "リピート率")).toContainText("期間全体 28.6%");

      // T-23：月次推移グラフ（AC-06）。9〜11月の3点。凡例・線の色（ネイビー系）・数字の表（読み上げ用）
      const trend = page.getByRole("region", { name: "月次推移（売上・粗利）" });
      await expect(trend.locator(".recharts-line")).toHaveCount(2);
      await expect(trend.locator('path.recharts-line-curve[stroke="var(--chart-series-1)"]')).toHaveCount(1);
      await expect(trend.locator('path.recharts-line-curve[stroke="var(--chart-series-3)"]')).toHaveCount(1);
      await expect(trend.locator(".recharts-line-dot")).toHaveCount(6);
      await expect(trend.getByRole("row", { name: /2025年11月 264,700 163,100/ })).toHaveCount(1);
      await expect(trend.getByRole("row", { name: /2025年9月 148,400 93,400/ })).toHaveCount(1);

      // 選べる月はデータのある月（新しい月が上）
      await expect(select.locator("option")).toHaveText(["2025年11月", "2025年10月", "2025年9月"]);

      // 2025-09：前月のデータがないので「—」と理由（画面の読み込みが終わる前の操作は無視されるため、効くまで選び直す）
      await expect(async () => {
        await select.selectOption("2025-09");
        await expect(page).toHaveURL(/month=2025-09/, { timeout: 3000 });
      }).toPass({ timeout: 20_000 });
      await expect(card(page, "売上")).toContainText("148,400");
      await expect(card(page, "売上").getByText("—", { exact: true })).toBeVisible();
      await expect(card(page, "売上")).toContainText("前月のデータがありません");
      await expect(card(page, "粗利")).toContainText("93,400");
      await expect(card(page, "粗利")).toContainText("前月のデータがありません");
      await expect(card(page, "リピート率")).toContainText("前月のデータがありません");
      await expect(page.getByRole("combobox", { name: "表示する月" })).toHaveValue("2025-09");

      // 不正な月・データのない月・不正な文字は、エラーにせず最新月で表示する
      for (const bad of ["2025-13", "2099-01", "abc", "2025-11%3Cscript%3E"]) {
        await page.goto(`/?month=${bad}`);
        await expect(page.getByRole("combobox", { name: "表示する月" })).toHaveValue("2025-11");
        await expect(card(page, "売上")).toContainText("264,700");
      }
    } finally {
      await deleteTempUser(user.id);
    }
  });

  // T-25（AC-07）：カテゴリ別売上・売れ筋トップ10と、表示期間（全期間／選択した月）の切り替え
  test("カテゴリ別・売れ筋の正解値と、期間の切り替え・不正な値", async ({ page }) => {
    const user = await createTempUser({ role: "operator" });
    const category = page.getByRole("region", { name: "カテゴリ別売上", exact: true });
    const sku = page.getByRole("region", { name: "売れ筋商品トップ10", exact: true });
    const periodLink = (region: typeof category, name: string) => region.getByRole("link", { name });
    try {
      await loginAs(page, user.email, user.password);
      await expect(page.getByRole("heading", { name: "ダッシュボード", level: 1 })).toBeVisible();

      // 初期表示は全期間。カテゴリ4種（合計 560,600）・棒4本
      await expect(category.locator(".recharts-bar-rectangle")).toHaveCount(4);
      // 棒の色はすべてネイビー系（色の変数が出ていないと黒になるため、4本とも違う色で、黒でないことを確かめる）
      const fills = await category
        .locator(".recharts-bar-rectangle path")
        .evaluateAll((els) => els.map((el) => getComputedStyle(el).fill));
      expect(fills).toHaveLength(4);
      expect(new Set(fills).size).toBe(4);
      expect(fills).not.toContain("rgb(0, 0, 0)");
      for (const [name, amount] of [["アウター", "287,400"], ["トップス", "114,400"], ["ボトムス", "82,200"], ["アクセサリー", "76,600"]]) {
        await expect(category.getByRole("row", { name: `${name} ${amount}` })).toHaveCount(1);
      }
      // SKU：数量の多い順。1位 LUM-TOP-01（14点）・2位 LUM-TOP-02（9点）・3位 LUM-ACC-01（8点）。SKU は8種類
      const skuRows = sku.getByRole("row");
      await expect(skuRows).toHaveCount(1 + 8);
      // 数量は右から2番目の列（スマホは SKU 列が隠れるので、左からの番号では数えない）
      const quantity = (n: number) => skuRows.nth(n).locator("td:nth-last-child(2)");
      await expect(skuRows.nth(1)).toContainText("LUM-TOP-01");
      await expect(quantity(1)).toHaveText("14");
      await expect(skuRows.nth(2)).toContainText("LUM-TOP-02");
      await expect(quantity(2)).toHaveText("9");
      await expect(skuRows.nth(3)).toContainText("LUM-ACC-01");
      await expect(quantity(3)).toHaveText("8");
      await expect(periodLink(category, "全期間")).toHaveAttribute("aria-current", "true");
      await expect(periodLink(sku, "全期間")).toHaveAttribute("aria-current", "true");

      // 「選択した月」（2025-11）：KPI の月と同じ月で、カテゴリ・売れ筋の両方が切り替わる
      await periodLink(category, "選択した月").click();
      await expect(page).toHaveURL(/month=2025-11&period=month/);
      await expect(category.getByRole("row", { name: "アウター 198,200" })).toHaveCount(1);
      await expect(category.getByRole("row", { name: "アクセサリー 14,800" })).toHaveCount(1);
      await expect(skuRows.nth(1)).toContainText("LUM-OUT-02");
      await expect(periodLink(sku, "選択した月")).toHaveAttribute("aria-current", "true");

      // 月を変えても、期間の選択（選択した月）が残る
      const select = page.getByRole("combobox", { name: "表示する月" });
      await expect(async () => {
        await select.selectOption("2025-10");
        await expect(page).toHaveURL(/month=2025-10&period=month/, { timeout: 3000 });
      }).toPass({ timeout: 20_000 });
      await expect(periodLink(category, "選択した月")).toHaveAttribute("aria-current", "true");

      // 不正な期間は全期間・不正な月は最新月に戻る（エラーにしない）
      for (const bad of ["weekly", "MONTH", "month%3Cscript%3E"]) {
        await page.goto(`/?period=${bad}`);
        await expect(periodLink(category, "全期間")).toHaveAttribute("aria-current", "true");
        await expect(category.getByRole("row", { name: "アウター 287,400" })).toHaveCount(1);
      }
      await page.goto("/?period=month&month=2099-01");
      await expect(select).toHaveValue("2025-11");
      await expect(category.getByRole("row", { name: "アウター 198,200" })).toHaveCount(1);
    } finally {
      await deleteTempUser(user.id);
    }
  });

  // 共通レイアウト：PC の左メニューは画面の高さいっぱいに固定され、下へスクロールしても（ログアウトも）見えたまま。
  // スマホの下のタブも、スクロールしても画面の下に見えたまま。全画面（/・/upload・/password・/admin）で同じ
  test("左メニュー（PC）・下のタブ（スマホ）はスクロールしても固定されている", async ({ page }, testInfo) => {
    const isPc = testInfo.project.name === "pc";
    const user = await createTempUser({ role: "admin" });
    try {
      await loginAs(page, user.email, user.password);
      await expect(page.getByRole("heading", { name: "ダッシュボード", level: 1 })).toBeVisible();
      const viewportHeight = page.viewportSize()!.height;

      for (const path of ["/", "/upload", "/password", "/admin"]) {
        await page.goto(path);
        await expect(page.locator("h1")).toBeVisible();
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        if (path === "/") {
          // ダッシュボードは画面より長い：実際にスクロールできている
          await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(200);
        }
        if (isPc) {
          const aside = page.locator("aside");
          const box = (await aside.boundingBox())!;
          expect(box.y, `${path} の左メニューの上端`).toBe(0);
          expect(box.height, `${path} の左メニューの高さ`).toBe(viewportHeight);
          await expect(aside.getByRole("button", { name: "ログアウト" })).toBeInViewport();
        } else {
          await expect(page.getByRole("navigation", { name: "メインメニュー" })).toBeInViewport({ ratio: 1 });
        }
      }
    } finally {
      await deleteTempUser(user.id);
    }
  });

  // データ0件：売上データのない「空のお店」の一時アカウントで確認する（LUMINA には触れない。終了時にお店ごと消す）
  test("データ0件のお店には、アップロードへの案内が出る", async ({ page }) => {
    const user = await createEmptyShopUser();
    try {
      await loginAs(page, user.email, user.password);
      await expect(page.getByRole("heading", { name: "ダッシュボード", level: 1 })).toBeVisible();
      await expect(page.getByRole("heading", { name: "売上データがまだありません" })).toBeVisible();
      await expect(page.getByText("CSVをアップロードすると")).toBeVisible();
      await expect(page.getByRole("link", { name: "CSVをアップロードする" })).toHaveAttribute("href", "/upload");
      // KPI・グラフは出さない
      await expect(page.getByRole("region", { name: "売上", exact: true })).toHaveCount(0);
      await expect(page.getByTestId("trend-chart")).toHaveCount(0);
      await expect(page.getByTestId("category-chart")).toHaveCount(0);
    } finally {
      await deleteEmptyShopUser(user);
    }
  });
});
