// 納品ドキュメント（README・docs/operations-manual.md）に載せる、番号つきの実画面（PC 幅 1280）を docs/images/ に撮る。
// 環境変数 DOC_SHOT=1 の時だけ動く（通常の npm run test:e2e には混ざらない）
// 実行：DOC_SHOT=1 npm run test:e2e -- tests/e2e/doc-screenshot.spec.ts --project=pc
// 架空のお店・アカウントを作り、自作CSVを画面の流れで取り込んで撮り、終わったらお店ごと消す。実の AI は呼ばない
import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  createEmptyShopUser,
  createShopMember,
  deleteEmptyShopUser,
  deleteShopUploads,
  deleteTempUser,
  hasEnv,
  loginWith,
  serviceClient,
} from "./support";

const OUT_DIR = "docs/images";
const DOMAIN = "lumina-sample.test"; // 架空のドメイン（example.com は使わない）
const SHOP_NAME = "LUMINA（見本）";

// 数字は自作CSV（tests/fixtures/lumina-sample-sales.csv）の 2025-11 の集計値（売上 253,500・粗利 142,500・前月 92,000）と一致させた見本
const SAMPLE_RESULT = {
  summary: "2025年11月の売上は253,500円で、前月比+175.5%と大きく伸びました。粗利は142,500円でした。",
  highlights: [
    "アウターの売上は200,000円で、カテゴリ別で最も大きい",
    "ウールコートとナイロンパーカーが売れ筋の上位を占めた",
    "粗利は142,500円で、売上の5割以上を確保できた",
  ],
  concerns: [
    "トップスの売上は21,000円にとどまり、構成比が低い",
    "アウターへの依存が高く、季節の変わり目に落ち込むおそれがある",
  ],
  actions: [
    { priority: "high", action: "アウターの購入者へ、トップスを組み合わせた提案を送る" },
    { priority: "medium", action: "売れ筋のアウターの在庫を、12月に向けて確認する" },
  ],
  numberWarnings: [],
};

const shot = async (page: Page, name: string, clip?: { x: number; y: number; width: number; height: number }) => {
  mkdirSync(OUT_DIR, { recursive: true });
  // 開発サーバーの丸いマークが万一出ても写らないよう隠す。グラフの吹き出しが出ないようマウスを端へ逃がす
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.mouse.move(0, 0);
  await page.screenshot({ path: `${OUT_DIR}/${name}.png`, caret: "initial", clip });
};

test.describe("納品ドキュメント用のスクショ", () => {
  test.skip(process.env.DOC_SHOT !== "1", "DOC_SHOT=1 の時だけ実行する");
  test.skip(!hasEnv, ".env.local がないため未実施");

  test("PC 幅の10枚", async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "pc", "pc プロジェクトだけで実行する");
    test.setTimeout(180_000);

    const admin = await createEmptyShopUser({
      shopName: SHOP_NAME,
      displayName: "テスト管理者",
      email: `admin@${DOMAIN}`,
      role: "admin",
    });
    const memberIds: string[] = [];
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    try {
      // 01 ログイン
      await page.goto("/login");
      await expect(page.getByRole("button", { name: "ログイン" })).toBeVisible();
      await shot(page, "01-login-pc");

      await loginWith(page, admin);
      await expect(page).toHaveURL(/\/$/);

      // 02・03 CSVアップロード
      await page.goto("/upload");
      await expect(page.getByRole("heading", { name: "CSVアップロード", level: 1 })).toBeVisible();
      await shot(page, "02-upload-pc");
      // 画面の準備（ハイドレーション）前に選ぶと無視されるため、結果が出るまで選び直す
      await expect(async () => {
        await page.getByTestId("csv-file-input").setInputFiles("tests/fixtures/lumina-sample-sales.csv");
        await expect(page.getByTestId("result-counts")).toContainText("48行 成功", { timeout: 3000 });
      }).toPass({ timeout: 20_000 });
      await expect(page.getByTestId("result-counts")).toContainText("0行 スキップ");
      await shot(page, "03-upload-preview-pc");
      await page.getByRole("button", { name: "取り込む" }).click();
      await expect(page.getByRole("status").filter({ hasText: "48行を取り込みました" })).toBeVisible();

      // 04 ダッシュボード上部（2025年11月・正解値の確認つき）
      await page.goto("/");
      const sales = page.getByRole("region", { name: "売上", exact: true });
      await expect(sales).toContainText("253,500");
      await expect(page.getByRole("region", { name: "粗利", exact: true })).toContainText("142,500");
      await expect(page.locator(".recharts-line-dot")).toHaveCount(6);
      await expect(page.locator(".recharts-bar-rectangle")).toHaveCount(4);
      await shot(page, "04-dashboard-top-pc");

      // 05 グラフ・カテゴリ別・売れ筋（背の高い画面にして、3つの区画を1枚に収める）
      await page.setViewportSize({ width: 1280, height: 1250 });
      // 画面に収まるため、スクロールせず、3つの区画（月次推移の上端〜売れ筋の下端）の範囲だけを切り出す（左メニューは入れない）
      const trendBox = await page.getByRole("region", { name: /月次推移/ }).boundingBox();
      const topBox = await page.getByRole("region", { name: /売れ筋商品/ }).boundingBox();
      expect(trendBox && topBox).toBeTruthy();
      const clipTop = trendBox!.y - 16;
      await shot(page, "05-dashboard-charts-pc", { x: 224, y: clipTop, width: 1280 - 224, height: topBox!.y + topBox!.height + 16 - clipTop });

      // 06 AI分析コメント（生成済みの見本を DB に入れて表示。実 API は呼ばない）
      const db = serviceClient();
      const { data: upload } = await db.from("uploads").select("id").eq("shop_id", admin.shopId).eq("target_month", "2025-11").single();
      expect(upload).toBeTruthy();
      const { error: reportError } = await db.from("reports").insert({
        upload_id: upload!.id,
        shop_id: admin.shopId,
        target_month: "2025-11",
        result: SAMPLE_RESULT,
        llm_provider: "gemini",
        has_number_warning: false,
        generated_at: "2025-12-01T05:05:00+00:00",
      });
      expect(reportError).toBeNull();
      await page.goto("/");
      const panel = page.getByRole("region", { name: "AI分析コメント", exact: true });
      await expect(panel.getByText("AI生成・要確認")).toBeVisible();
      await expect(panel.getByText("数字を確認してください")).toHaveCount(0);
      await expect(page.locator(".recharts-line-dot")).toHaveCount(6);
      const panelTop = await panel.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
      await page.evaluate((y) => window.scrollTo(0, y - 24), panelTop);
      await shot(page, "06-analysis-pc");
      await page.setViewportSize({ width: 1280, height: 800 });

      // 07・08 管理者画面（メンバー一覧と追加ダイアログ）
      const members = [
        { displayName: "サンプル 花子", email: `hanako@${DOMAIN}`, role: "operator" as const },
        { displayName: "サンプル 太郎", email: `taro@${DOMAIN}`, role: "operator" as const, status: "leave" as const },
        { displayName: "サンプル 次郎", email: `jiro@${DOMAIN}`, role: "operator" as const, status: "retired" as const },
      ];
      const created = [];
      for (const m of members) {
        const made = await createShopMember(admin.shopId, m);
        memberIds.push(made.id);
        created.push(made);
      }
      await page.goto("/admin");
      await expect(page.getByRole("heading", { name: "管理者", level: 1 })).toBeVisible();
      await expect(page.getByRole("button", { name: "サンプル 花子さんの操作" })).toBeVisible();
      await shot(page, "07-admin-pc");

      await page.getByRole("button", { name: "メンバー追加" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.getByRole("dialog").getByLabel("名前")).toBeVisible();
      await shot(page, "08-admin-add-pc");
      await page.keyboard.press("Escape");

      // 09 パスワード変更
      await page.goto("/password");
      await expect(page.getByLabel("現在のパスワード")).toBeVisible();
      await shot(page, "09-password-change-pc");

      // 10 退職にしたアカウントでログイン（別のブラウザの状態で）
      const retiredContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const retiredPage = await retiredContext.newPage();
      await loginWith(retiredPage, created[2]);
      await expect(retiredPage.getByText("アカウントが停止されています")).toBeVisible();
      await shot(retiredPage, "10-suspended-pc");
      await retiredContext.close();
    } finally {
      await context.close();
      // 片付け：メンバー → 見本の売上・AI分析 → 管理者アカウント → お店の順
      for (const id of memberIds) await deleteTempUser(id);
      await deleteShopUploads(admin.shopId);
      await deleteEmptyShopUser(admin);
    }
  });
});
