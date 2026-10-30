// LP のノート PC モックアップ用スクショ（AI 欄あり）を、Gemini への通信をモックにして撮る。
// 本物のキー・本物の Gemini は使わない。環境変数 LP_SHOT=1 の時だけ動く（普段の npm run test:demo-e2e では動かさない）
//
// 実行：LP_SHOT=1 npm run test:demo-e2e -- tests/demo-e2e/lp-mock-screenshot.spec.ts --project=pc
//   （PowerShell：$env:LP_SHOT="1"; npm run test:demo-e2e -- tests/demo-e2e/lp-mock-screenshot.spec.ts --project=pc）
//
// 保存先（demo/public/lp/dashboard-pc.png は上書きしない。確認してから置き換える）
//   local-output/screenshots/lp-ai/dashboard-pc-mock.png          … 候補（lp-screenshot.spec.ts と同じ寸法・同じ撮り方）
//   local-output/screenshots/lp-ai/dashboard-pc-mock-mockup.png  … LP のノート PC に写る範囲（幅:高さ = 7:6 で上から）の確認用
// 撮影時だけ、キー入力欄・成功メッセージを隠す（LP_AI_KEEP_KEY_AREA=1 で隠さない）
import { mkdirSync } from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { analysisResultSchema } from "../../src/lib/analysis/schema";
import { generateButton, keyField, loadSampleData, mockGemini, respondSuccess } from "./support";

const MOCK_KEY = "mock-key-DUMMY";
const OUT_DIR = "local-output/screenshots/lp-ai";
const KEEP_KEY_AREA = process.env.LP_AI_KEEP_KEY_AREA === "1";
// LaptopMockup の画面の縦横比（demo/components/lp/LaptopMockup.tsx の aspect-[7/6]）
const MOCKUP_RATIO = 6 / 7;

// 11月（最新月）のダミーデータの正解値（tests/unit/demo-sample-csv.test.ts）：
//   売上 120,000円（前月比 +15.4%）／粗利 72,600円／リピート率 66.7%（前月差 +12.1ポイント）
//   カテゴリ別売上：アウター 40,000円・小物 29,000円・トップス 28,000円・ボトムス 23,000円（9月・10月のトップスは各 40,000円）
// 文中の数字は、これと厳密に一致するものだけを書く（数字の照合で警告が出ない内容）
const mockAnalysis = analysisResultSchema.parse({
  summary:
    "11月は売上120,000円（前月比+15.4%）、粗利72,600円と、3か月で最も高い水準になりました。リピート率も66.7%まで上がり、既存のお客様が支えた月です。",
  highlights: [
    "アウターの売上が40,000円で、カテゴリ別の首位になった",
    "リピート率が前月より+12.1ポイント上がり、66.7%になった",
    "粗利が72,600円で、売上の伸びとあわせて増えた",
  ],
  concerns: ["ボトムスの売上が23,000円と、4カテゴリで最も小さい", "トップスの売上が28,000円と、前の2か月より下がっている"],
  actions: [
    { priority: "high", action: "アウターの購入者に、トップスやボトムスを合わせる提案を送り、売上の幅を広げる" },
    { priority: "high", action: "11月に初めて買ったお客様へ、12月に再購入を促すフォローメールを送る" },
    { priority: "medium", action: "トップスの定番商品の在庫と見せ方を見直し、売上が下がった理由を確かめる" },
  ],
});

test.describe("LP のスクショ（AI 欄あり・Gemini はモック）", () => {
  test.skip(process.env.LP_SHOT !== "1", "LP_SHOT=1 の時だけ実行する（スクショを勝手に作り直さない）");

  test("モックの AI 分析を生成して、ダッシュボードを撮る", async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "pc", "pc プロジェクトだけで実行する（--project=pc）");
    mkdirSync(OUT_DIR, { recursive: true });

    // lp-screenshot.spec.ts と同じ 1280×800 で撮る。相対 URL のため baseURL を渡す
    const context = await browser.newContext({ baseURL: "http://localhost:3100", viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    const gemini = await mockGemini(page, respondSuccess(JSON.stringify(mockAnalysis)));

    await loadSampleData(page);
    await expect(page.locator(".recharts-bar-rectangle").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(".recharts-line-dot").first()).toBeVisible();

    // 画面の準備（ハイドレーション）前の入力は消えることがあるため、入力が残るまで入れ直す
    await expect(async () => {
      await keyField(page).fill(MOCK_KEY);
      expect(await keyField(page).inputValue()).toBe(MOCK_KEY);
    }).toPass({ timeout: 10_000 });
    await generateButton(page).click();

    const panel = page.locator("section[aria-labelledby]", { has: page.getByRole("heading", { name: "AI分析コメント" }) });
    await expect(panel.getByText("AI生成・要確認")).toBeVisible({ timeout: 20_000 });
    await expect(panel.getByText(mockAnalysis.summary)).toBeVisible();
    await expect(generateButton(page)).toBeEnabled();
    expect(gemini.length, "Gemini への通信は1回（モック）").toBe(1);

    // 数字の照合の警告が出ていないこと（出たら LP には使わない）
    await expect(panel.getByText("数字を確認してください")).toHaveCount(0);

    // 画面の数字が11月の正解値であること
    const dashboardText = await page.locator("#demo-dashboard").innerText();
    for (const value of ["120,000", "72,600", "66.7"]) expect(dashboardText, `画面に ${value} がある`).toContain(value);

    // スクショの前の確認：キー入力欄が空であること（成功後に欄が消える作りなら、欄がないこと）
    if ((await keyField(page).count()) > 0) expect((await keyField(page).inputValue()).length, "キー入力欄が空になっていません").toBe(0);
    const keyShown = await page.evaluate((k) => {
      const inInputs = Array.from(document.querySelectorAll("input, textarea")).some((el) => (el as HTMLInputElement).value.includes(k));
      return inInputs || document.documentElement.outerHTML.includes(k);
    }, MOCK_KEY);
    expect(keyShown, "ダミーのキーが画面に残っています").toBe(false);

    await hideForShot(page, panel);
    await page.mouse.move(0, 0); // グラフの吹き出しが写り込まないよう端へ逃がす

    const dashboard = page.locator("#demo-dashboard");
    await dashboard.screenshot({ path: `${OUT_DIR}/dashboard-pc-mock.png`, caret: "initial" });

    // LP のノート PC に写る範囲（上から 7:6）の確認用と、AI 欄がその範囲にどれだけ入るかの計測
    const box = await dashboard.boundingBox();
    if (box === null) throw new Error("ダッシュボードの位置が取れませんでした。");
    const scroll = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
    const windowHeight = Math.round(box.width * MOCKUP_RATIO);
    await page.screenshot({
      path: `${OUT_DIR}/dashboard-pc-mock-mockup.png`,
      fullPage: true,
      clip: { x: box.x + scroll.x, y: box.y + scroll.y, width: box.width, height: windowHeight },
      caret: "initial",
    });
    const panelBox = await panel.boundingBox();
    if (panelBox !== null) {
      const top = Math.round(panelBox.y - box.y);
      const visible = Math.max(0, Math.min(windowHeight - top, panelBox.height));
      console.log(
        `[lp-mock] 画像の高さ ${Math.round(box.height)}px／モックアップに写る高さ ${windowHeight}px／AI 欄は上から ${top}px から ${Math.round(panelBox.height)}px（うち ${Math.round(visible)}px が写る）`,
      );
    }
    await context.close();
  });
});

/** 撮影時だけの調整。開発サーバーの「N」マークを隠し、（既定では）キー入力欄・成功メッセージを隠す */
async function hideForShot(page: Page, panel: Locator) {
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  const portalShown = await page.evaluate(() =>
    Array.from(document.querySelectorAll("nextjs-portal")).some((el) => getComputedStyle(el).display !== "none"),
  );
  expect(portalShown, "開発サーバーの「N」マークが隠れていません").toBe(false);

  if (KEEP_KEY_AREA) return;
  // AI 欄の直下の子のうち、キー入力欄を含む塊と、成功メッセージだけを隠す（分析そのものは触らない）
  await panel.evaluate((root) => {
    for (const child of Array.from(root.children)) {
      const el = child as HTMLElement;
      const hasInput = el.querySelector("input") !== null;
      const isSuccess = (el.textContent ?? "").startsWith("分析を生成しました");
      if (hasInput || isSuccess) el.style.display = "none";
    }
  });
}
