// LP のノート PC モックアップ用スクショを、AI 欄が「実物」（ダミーデータで本物の Gemini が作った分析）の状態で撮り直す。
// 本物の Gemini を呼ぶ。キーはオーナーが自分の PC のターミナルで環境変数 DEMO_GEMINI_KEY に入れる（AI・CI は動かさない）。
//
// 実行（デモの開発サーバーを別のターミナルで起動しておく：npm run dev --workspace=demo -- --port 3100）
//   PowerShell：$env:DEMO_URL="http://localhost:3100"; $env:DEMO_GEMINI_KEY="（キー）"; npm run test:e2e -- tests/e2e/lp-ai-screenshot.spec.ts --project=pc
//   Bash      ：DEMO_URL=http://localhost:3100 DEMO_GEMINI_KEY="（キー）" npm run test:e2e -- tests/e2e/lp-ai-screenshot.spec.ts --project=pc
// 撮り終えたら、キーの環境変数を消す（PowerShell：Remove-Item Env:DEMO_GEMINI_KEY ／ Bash：unset DEMO_GEMINI_KEY）
//
// 保存先（demo/public/lp/dashboard-pc.png は上書きしない。オーナーが見てから置き換える）
//   local-output/screenshots/lp-ai/dashboard-pc-ai-<タグ>.png          … 候補（lp-screenshot.spec.ts と同じ寸法・同じ撮り方）
//   local-output/screenshots/lp-ai/dashboard-pc-ai-<タグ>-mockup.png    … LP のノート PC に写る範囲（幅:高さ = 7:6 で上から）の確認用
//   local-output/screenshots/lp-ai/dashboard-pc-before-<タグ>.png       … 撮り直す前の画像のコピー（すでにあれば作らない）
// タグ：環境変数 LP_AI_SHOT_TAG（既定 1）。キー入力欄・成功メッセージは撮影時だけ隠す（LP_AI_KEEP_KEY_AREA=1 で隠さない）
//
// キーの扱い：ファイル・ログ・スクショに残さない。トレース・動画・失敗時のスクショは切る。console には何も出さない（キーを含まない文だけ）
import { copyFileSync, constants, existsSync, mkdirSync } from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { generateButton, keyField, loadSampleData } from "../demo-e2e/support";

const DEMO_URL = process.env.DEMO_URL;
const TAG = process.env.LP_AI_SHOT_TAG ?? "1";
const KEEP_KEY_AREA = process.env.LP_AI_KEEP_KEY_AREA === "1";
const OUT_DIR = "local-output/screenshots/lp-ai";
const CURRENT_IMAGE = "demo/public/lp/dashboard-pc.png";
// LaptopMockup の画面の縦横比（demo/components/lp/LaptopMockup.tsx の aspect-[7/6]）
const MOCKUP_RATIO = 6 / 7;

// キーが入ったままの記録（トレース・動画・失敗時のスクショ）を作らない
test.use({ trace: "off", video: "off", screenshot: "off" });

test.describe("LP のスクショ（AI 欄あり）", () => {
  test.skip(!DEMO_URL, "DEMO_URL がないため未実施");

  test("AI 分析を実際に生成して、ダッシュボードを撮る", async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "pc", "pc プロジェクトだけで実行する（--project=pc）");
    test.setTimeout(180_000);

    const key = (process.env.DEMO_GEMINI_KEY ?? "").trim();
    if (key === "") {
      // ブラウザを開く前に止める。キーの値は扱わない
      throw new Error(
        "環境変数 DEMO_GEMINI_KEY が空です。自分の PC のターミナルで、Gemini API キーを DEMO_GEMINI_KEY に入れてから実行してください（PowerShell：$env:DEMO_GEMINI_KEY=\"キー\" ／ Bash：DEMO_GEMINI_KEY=\"キー\" をコマンドの前につける）。",
      );
    }

    mkdirSync(OUT_DIR, { recursive: true });
    // 撮り直す前の画像のバックアップ（すでにあれば上書きしない）
    const backupPath = `${OUT_DIR}/dashboard-pc-before-${TAG}.png`;
    if (existsSync(CURRENT_IMAGE) && !existsSync(backupPath)) {
      copyFileSync(CURRENT_IMAGE, backupPath, constants.COPYFILE_EXCL);
    }

    // lp-screenshot.spec.ts と同じ画面の大きさ。相対 URL のため baseURL にデモの URL を渡す
    const context = await browser.newContext({ baseURL: DEMO_URL, viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    try {
      await loadSampleData(page);
      await expect(page.locator(".recharts-bar-rectangle").first()).toBeVisible({ timeout: 20_000 });
      await expect(page.locator(".recharts-line-dot").first()).toBeVisible();

      // 画面の準備（ハイドレーション）前の入力は消えることがあるため、入力が残るまで入れ直す。キーは出力しない
      await expect(async () => {
        await keyField(page).fill(key);
        expect((await keyField(page).inputValue()) === key).toBe(true);
      }).toPass({ timeout: 10_000 });
      await generateButton(page).click();
    } finally {
      // どこで失敗しても、入力欄にキーを残さない（失敗時の画面の記録に入らないように）
      await keyField(page)
        .fill("")
        .catch(() => undefined);
    }

    // 生成の完了を待つ（成功すると「AI生成・要確認」のバッジが出る）。失敗時は画面の固定の案内文だけを出す
    const panel = page.locator("section[aria-labelledby]", { has: page.getByRole("heading", { name: "AI分析コメント" }) });
    const done = panel.getByText("AI生成・要確認");
    try {
      await done.waitFor({ state: "visible", timeout: 90_000 });
    } catch {
      const text = (await panel.innerText()).replace(/\s+/g, " ").slice(0, 400);
      throw new Error(`AI 分析が生成できませんでした（90秒待っても完了しません）。画面の表示：${text}`);
    }
    await expect(page.getByRole("button", { name: "分析を生成" })).toBeEnabled();

    // 数字の照合の警告が出た分析は、LP に使わない（もう一度実行すれば、別の文が生成される）
    if ((await panel.getByText("数字を確認してください").count()) > 0) {
      throw new Error("生成された分析に「数字を確認してください」の警告が出ました。LP には使わないため、保存せずに止めます。もう一度実行してください。");
    }

    // スクショの前の確認：キーが入力欄にも、画面・保存領域（localStorage・sessionStorage）にも残っていないこと
    expect((await keyField(page).inputValue()).length, "キー入力欄が空になっていません").toBe(0);
    const keyLeaked = await page.evaluate((k) => {
      const inInputs = Array.from(document.querySelectorAll("input, textarea")).some((el) => (el as HTMLInputElement).value.includes(k));
      const inPage = document.documentElement.outerHTML.includes(k);
      const inStorage = [localStorage, sessionStorage].some((s) => Object.keys(s).some((name) => name.includes(k) || (s.getItem(name) ?? "").includes(k)));
      return inInputs || inPage || inStorage;
    }, key);
    expect(keyLeaked, "キーが画面または保存領域に残っています").toBe(false);

    await hideForShot(page, panel);
    await page.mouse.move(0, 0); // グラフの吹き出しが写り込まないよう端へ逃がす

    const dashboard = page.locator("#demo-dashboard");
    await dashboard.screenshot({ path: `${OUT_DIR}/dashboard-pc-ai-${TAG}.png`, caret: "initial" });

    // LP のノート PC に写る範囲（上から 7:6）の確認用と、AI 欄がその範囲にどれだけ入るかの計測
    const box = await dashboard.boundingBox();
    if (box === null) throw new Error("ダッシュボードの位置が取れませんでした。");
    const scroll = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
    const windowHeight = Math.round(box.width * MOCKUP_RATIO);
    await page.screenshot({
      path: `${OUT_DIR}/dashboard-pc-ai-${TAG}-mockup.png`,
      fullPage: true,
      clip: { x: box.x + scroll.x, y: box.y + scroll.y, width: box.width, height: windowHeight },
      caret: "initial",
    });
    const panelBox = await panel.boundingBox();
    if (panelBox !== null) {
      const top = Math.round(panelBox.y - box.y);
      const visible = Math.max(0, Math.min(windowHeight - top, panelBox.height));
      // キーを含まない数字だけ
      console.log(`[lp-ai] 画像の高さ ${Math.round(box.height)}px／モックアップに写る高さ ${windowHeight}px／AI 欄は上から ${top}px から ${Math.round(panelBox.height)}px（うち ${Math.round(visible)}px が写る）`);
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
  // AI 欄の直下の子のうち、キー入力欄を含む塊と、成功メッセージだけを隠す（生成された分析そのものは触らない）
  await panel.evaluate((root) => {
    for (const child of Array.from(root.children)) {
      const el = child as HTMLElement;
      const hasInput = el.querySelector("input") !== null;
      const isSuccess = (el.textContent ?? "").startsWith("分析を生成しました");
      if (hasInput || isSuccess) el.style.display = "none";
    }
  });
}
