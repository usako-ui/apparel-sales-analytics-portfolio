// T-34・35：AI分析コメントの表示（AC-08 の表示部分・AC-09 の KPI とグラフの共存）
// 重要：「分析を生成」ボタンは押さない（押すと本物の AI の API に届くため）。
// 代わりに、売上のない「空のお店」に架空の月（2097-01〜03）と AI分析の見本（reports）を service role で入れ、表示だけを確かめる。
// 2097-01＝正常／2097-02＝数字の警告あり／2097-03＝まだ生成していない。LUMINA の本物の月には触れない。終了時はお店ごと片付ける
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  createEmptyShopUser,
  deleteEmptyShopUser,
  deleteShopUploads,
  hasEnv,
  loginAs,
  sampleAnalysisResult,
  seedShopMonths,
} from "./support";

const panel = (page: Page) => page.getByRole("region", { name: "AI分析コメント", exact: true });

test.describe("AI分析コメントの表示（検証用 Supabase・実際の AI は呼ばない）", () => {
  test.skip(!hasEnv, ".env.local がないため未実施");
  // ログイン回数の上限があるため、1人のログインで全部の確認をまとめる
  test.describe.configure({ mode: "serial" });

  test("正常・数字の警告あり・未生成の表示と、KPI・グラフの共存", async ({ page }) => {
    const user = await createEmptyShopUser();
    try {
      await seedShopMonths(user, [
        { month: "2097-01", report: { result: sampleAnalysisResult(false) } },
        { month: "2097-02", report: { result: sampleAnalysisResult(true) } },
        { month: "2097-03" },
      ]);
      await loginAs(page, user.email, user.password);
      await expect(page.getByRole("heading", { name: "ダッシュボード", level: 1 })).toBeVisible();

      // 初期表示は最新月（2097-03）＝まだ生成していない。ボタンは押せる。KPI・グラフは表示されている
      await expect(page.getByRole("combobox", { name: "表示する月" })).toHaveValue("2097-03");
      await expect(panel(page).getByText("2097年3月の分析コメントは、まだありません")).toBeVisible();
      await expect(panel(page).getByText("AI生成・要確認")).toHaveCount(0);
      await expect(panel(page).getByRole("button", { name: "分析を生成" })).toBeEnabled();
      await expect(page.getByRole("region", { name: "売上", exact: true })).toContainText("10,000");
      await expect(page.getByRole("region", { name: "月次推移（売上・粗利）" })).toBeVisible();

      // 正常：まとめ・注目点3・気になる点2・打ち手と優先度・「AI生成・要確認」。警告は出ない
      await page.goto("/?month=2097-01");
      await expect(panel(page).getByText("AI生成・要確認")).toBeVisible();
      await expect(panel(page).getByText("2026年10月27日 14:05 に生成")).toBeVisible();
      await expect(panel(page).getByText("前月比+100.0%と大きく伸びました", { exact: false })).toBeVisible();
      await expect(panel(page).getByRole("heading", { name: "注目点" })).toBeVisible();
      await expect(panel(page).getByRole("heading", { name: "気になる点" })).toBeVisible();
      await expect(panel(page).getByRole("heading", { name: "来月の打ち手" })).toBeVisible();
      await expect(panel(page).locator("li")).toHaveCount(3 + 2 + 2);
      await expect(panel(page).getByText("優先度 高")).toBeVisible();
      await expect(panel(page).getByText("優先度 中")).toBeVisible();
      await expect(panel(page).getByText("数字を確認してください")).toHaveCount(0);

      // 警告あり：「数字を確認してください」と一致しなかった数値。コメントは表示したまま
      await page.goto("/?month=2097-02");
      const warning = panel(page).getByRole("alert");
      await expect(warning).toContainText("数字を確認してください");
      await expect(warning).toContainText("約30万円");
      await expect(warning).toContainText("+12.3%");
      await expect(panel(page).getByText("AI生成・要確認")).toBeVisible();
      await expect(panel(page).getByText("前月比+100.0%と大きく伸びました", { exact: false })).toBeVisible();
      await expect(page.getByRole("region", { name: "売上", exact: true })).toContainText("10,000");
    } finally {
      await deleteShopUploads(user.shopId);
      await deleteEmptyShopUser(user);
    }
  });
});
