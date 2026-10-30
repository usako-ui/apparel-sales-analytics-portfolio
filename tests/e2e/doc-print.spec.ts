// 印刷用の手順書（docs/print/monthly-guide-a4.html）から、A4 片面 1 枚の PDF を作る。
// 環境変数 DOC_PDF=1 の時だけ動く（通常の npm run test:e2e では skip）
// 実行：DOC_PDF=1 npm run test:e2e -- tests/e2e/doc-print.spec.ts --project=pc
// サーバーも DB も使わず、HTML をファイルとして開いて PDF にするだけ。外部の通信はしない
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "@playwright/test";

const HTML_PATH = resolve("docs/print/monthly-guide-a4.html");
const PDF_PATH = resolve("docs/print/monthly-guide-a4.pdf");

test.describe("印刷用 A4 の PDF", () => {
  test.skip(!process.env.DOC_PDF, "DOC_PDF=1 がないため未実施");

  test("A4 片面 1 枚の PDF を作る", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "pc", "pc プロジェクトだけで実行する");
    await page.goto(pathToFileURL(HTML_PATH).href);
    await page.emulateMedia({ media: "print" });

    await page.pdf({
      path: PDF_PATH,
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true, // 余白は HTML の @page（12mm）に従う
    });

    // 1 枚に収まっていること：PDF のページ数を数える（/Type /Page。/Type /Pages は含めない）
    const pdfText = readFileSync(PDF_PATH).toString("latin1");
    const pageCount = (pdfText.match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length;
    expect(pageCount, "PDF のページ数").toBe(1);
  });

  // 目で見る確認用：A4 の本文の幅（210mm − 余白 24mm ≒ 703px）で撮った画像を、DOC_PDF_PREVIEW の場所に保存する
  test("確認用の画像を撮る", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "pc", "pc プロジェクトだけで実行する");
    const previewPath = process.env.DOC_PDF_PREVIEW;
    test.skip(!previewPath, "DOC_PDF_PREVIEW がないため未実施");
    await page.setViewportSize({ width: 703, height: 1000 });
    await page.goto(pathToFileURL(HTML_PATH).href);
    await page.emulateMedia({ media: "print" });
    // 本文の高さ（A4 の高さ 297mm − 余白 24mm ≒ 1032px）に収まっていること
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    expect(height, "本文の高さ（px）").toBeLessThanOrEqual(1032);
    await page.screenshot({ path: previewPath!, fullPage: true });
  });
});
