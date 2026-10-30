// LP（紹介ページ）のスクショ撮影。環境変数 DEMO_URL（デモの開発サーバー）がない時は実行しない。
// 実行：DEMO_URL=http://localhost:3100 npm run test:e2e -- tests/e2e/lp-screenshot.spec.ts
// 1) /demo でダミーデータを読み込み、PC 幅のダッシュボードを demo/public/lp/dashboard-pc.png に保存（ノート PC の画面に使う）
// 2) / を PC（1440）とスマホ（390）で全体撮りし、local-output/lp-shots/ に保存（LP_SHOT_TAG で名前の末尾を変える）
import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";

const DEMO_URL = process.env.DEMO_URL;
const TAG = process.env.LP_SHOT_TAG ?? "1";
const SHOT_DIR = "local-output/lp-shots";
const DASHBOARD_IMAGE = "demo/public/lp/dashboard-pc.png";

test.describe("LP のスクショ", () => {
  test.skip(!DEMO_URL, "DEMO_URL がないため未実施");
  // PC・スマホの両プロジェクトで二重に動かさない（中で幅を指定して撮る）
  const SKIP_REASON = "pc プロジェクトだけで実行する";

  test("デモのダッシュボードを撮る", async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "pc", SKIP_REASON);
    mkdirSync("demo/public/lp", { recursive: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.goto(`${DEMO_URL}/demo`);
    // 画面の準備（ハイドレーション）前に押すと無視されるため、取り込みの確認が出るまで押し直す
    await expect(async () => {
      await page.getByRole("button", { name: "ダミーCSVで試す" }).click();
      await expect(page.getByRole("button", { name: "取り込む" })).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 20_000 });
    await page.getByRole("button", { name: "取り込む" }).click();
    await expect(page.locator(".recharts-bar-rectangle").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(".recharts-line-dot").first()).toBeVisible();
    await page.mouse.move(0, 0); // グラフの吹き出しが写り込まないよう端へ逃がす
    await page.locator("#demo-dashboard").screenshot({ path: DASHBOARD_IMAGE, caret: "initial" });
    await context.close();
  });

  // 中間の幅（1280・1024）でも、浮かぶカードがノート PC の月の選び欄を隠さないか見るための、ファーストビューだけの撮影
  for (const width of [1280, 1024] as const) {
    test(`LP ファーストビュー（${width}幅）`, async ({ browser }, testInfo) => {
      test.skip(testInfo.project.name !== "pc", SKIP_REASON);
      mkdirSync(SHOT_DIR, { recursive: true });
      const context = await browser.newContext({ viewport: { width, height: 800 }, reducedMotion: "reduce" });
      const page = await context.newPage();
      await page.goto(`${DEMO_URL}/`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.waitForLoadState("networkidle");
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      await page.locator("section").first().screenshot({ path: `${SHOT_DIR}/lp-hero-${width}-${TAG}.png`, caret: "initial" });
      await context.close();
    });
  }

  // 説明文の折り返し（句点・読点）の確認用に、本文のある節を拡大して撮る。できること（features）は 3 つの幅、ほかは PC とスマホ
  const SECTION_TITLES = { features: "lp-features-title", problems: "lp-problems-title", steps: "lp-steps-title", points: "lp-points-title", about: "lp-about-title" } as const;
  for (const [name, width] of [
    ["pc", 1440],
    ["1024", 1024],
    ["sp", 390],
  ] as const) {
    test(`LP 節の拡大（${name}・${width}幅）`, async ({ browser }, testInfo) => {
      test.skip(testInfo.project.name !== "pc", SKIP_REASON);
      mkdirSync(SHOT_DIR, { recursive: true });
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
      const page = await context.newPage();
      await page.goto(`${DEMO_URL}/`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.waitForLoadState("networkidle");
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      for (const [section, titleId] of Object.entries(SECTION_TITLES)) {
        if (name === "1024" && section !== "features") continue;
        await page.locator(`section[aria-labelledby="${titleId}"]`).screenshot({ path: `${SHOT_DIR}/lp-${section}-${name}-${TAG}.png`, caret: "initial" });
      }
      await context.close();
    });
  }

  for (const [name, width, height] of [
    ["pc", 1440, 900],
    ["sp", 390, 844],
  ] as const) {
    test(`LP 全体（${name}・${width}幅）`, async ({ browser }, testInfo) => {
      test.skip(testInfo.project.name !== "pc", SKIP_REASON);
      mkdirSync(SHOT_DIR, { recursive: true });
      // 動き（ふわっと出る・数え上がり・上下）を止めた「最終の表示」を撮る
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce" });
      const page = await context.newPage();
      await page.goto(`${DEMO_URL}/`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.waitForLoadState("networkidle");
      // 開発サーバーの丸い「N」のマークが写り込まないよう隠す（画面の部品ではない）
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      await page.screenshot({ path: `${SHOT_DIR}/lp-${name}-${TAG}.png`, fullPage: true, caret: "initial" });

      // ファーストビューだけの拡大（文字・浮かぶカードの確認用）
      await page.locator("section").first().screenshot({ path: `${SHOT_DIR}/lp-hero-${name}-${TAG}.png`, caret: "initial" });

      // 横ずれがない（ページの幅が画面の幅を超えない）
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);

      // ボタン・リンクの高さは 44px 以上（スマホ）。GitHub のリンクも含める（URL があるので押せるリンク）
      if (name === "sp") {
        const heights = await page.locator("a, [role=link]:not([aria-disabled=true])").evaluateAll((els) =>
          els.map((el) => ({ text: (el.textContent ?? "").trim(), height: el.getBoundingClientRect().height })),
        );
        for (const item of heights) expect(item.height, `${item.text} の高さ`).toBeGreaterThanOrEqual(44);
      }
      await context.close();
    });
  }
});
