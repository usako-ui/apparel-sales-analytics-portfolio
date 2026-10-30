// キーの扱いと通信先（architecture.md 第19項「キーの扱い」）。ダミーのキー文字列だけを使う
import { expect, test, type Page } from "@playwright/test";
import {
  clearKeyButton,
  DEMO_HOST,
  DUMMY_KEY,
  enterKeyAndGenerate,
  GEMINI_HOST,
  generateButton,
  keyField,
  loadSampleData,
  mockGemini,
  respondError,
  respondSuccess,
  SUCCESS_SUMMARY,
} from "./support";

/** localStorage・sessionStorage の全部（名前と値）に、文字列が含まれるか */
async function storageContains(page: Page, needle: string): Promise<{ local: boolean; session: boolean }> {
  return page.evaluate((text) => {
    const dump = (storage: Storage) =>
      Array.from({ length: storage.length }, (_, i) => {
        const name = storage.key(i) ?? "";
        return `${name}=${storage.getItem(name) ?? ""}`;
      }).join("\n");
    return { local: dump(localStorage).includes(text), session: dump(sessionStorage).includes(text) };
  }, needle);
}

test.describe("キーの扱い", () => {
  test("入力したキーは、localStorage・sessionStorage・URL・Cookie・console・画面のどこにも出ない（成功のあと）", async ({ page, context }) => {
    const logs: string[] = [];
    page.on("console", (message) => logs.push(message.text()));
    page.on("pageerror", (error) => logs.push(String(error)));
    await mockGemini(page, respondSuccess());
    await loadSampleData(page);
    await enterKeyAndGenerate(page);
    await expect(page.getByText(SUCCESS_SUMMARY)).toBeVisible({ timeout: 20_000 });

    const storage = await storageContains(page, DUMMY_KEY);
    expect(storage.local, "localStorage").toBe(false);
    expect(storage.session, "sessionStorage").toBe(false);
    expect(page.url(), "URL").not.toContain(DUMMY_KEY);
    expect(await page.evaluate(() => document.cookie), "document.cookie").not.toContain(DUMMY_KEY);
    expect(JSON.stringify(await context.cookies()), "Cookie").not.toContain(DUMMY_KEY);
    expect(logs.join("\n"), "console").not.toContain(DUMMY_KEY);
    // 画面の文字・HTML・入力欄の値のどれにも再表示されない
    expect(await page.locator("body").innerText(), "画面の文字").not.toContain(DUMMY_KEY);
    expect(await page.content(), "HTML").not.toContain(DUMMY_KEY);
    await expect(keyField(page)).toHaveValue("");
  });

  test("失敗のあとも、キーはどこにも出ない（400 の場合）", async ({ page, context }) => {
    const logs: string[] = [];
    page.on("console", (message) => logs.push(message.text()));
    await mockGemini(page, respondError(400));
    await loadSampleData(page);
    await enterKeyAndGenerate(page);
    await expect(page.getByText("キーが正しくないようです。")).toBeVisible({ timeout: 20_000 });

    const storage = await storageContains(page, DUMMY_KEY);
    expect(storage.local).toBe(false);
    expect(storage.session).toBe(false);
    expect(page.url()).not.toContain(DUMMY_KEY);
    expect(JSON.stringify(await context.cookies())).not.toContain(DUMMY_KEY);
    expect(logs.join("\n")).not.toContain(DUMMY_KEY);
    expect(await page.content()).not.toContain(DUMMY_KEY);
  });

  test("再読み込みするとキーは消え、「分析を生成」は押せなくなる", async ({ page }) => {
    await mockGemini(page, respondSuccess());
    await loadSampleData(page);
    await enterKeyAndGenerate(page);
    await expect(page.getByText(SUCCESS_SUMMARY)).toBeVisible({ timeout: 20_000 });

    await page.reload();
    await expect(page.getByRole("heading", { name: "AI分析コメント" })).toBeVisible({ timeout: 20_000 });
    await expect(generateButton(page)).toBeDisabled();
    await expect(keyField(page)).toHaveValue("");
  });

  test("「キーを消す」で、入力欄も保持しているキーも消え、通信もできなくなる", async ({ page }) => {
    const gemini = await mockGemini(page, respondSuccess());
    await loadSampleData(page);
    await enterKeyAndGenerate(page);
    await expect(page.getByText(SUCCESS_SUMMARY)).toBeVisible({ timeout: 20_000 });
    expect(gemini.length).toBe(1);

    await clearKeyButton(page).click();
    await expect(keyField(page)).toHaveValue("");
    await expect(page.getByText("キーはこの画面を開いている間だけ保持しています。")).toHaveCount(0);
    await expect(generateButton(page)).toBeDisabled();
    await expect(page.getByText("Gemini API キーを入力すると、「分析を生成」を押せるようになります。")).toBeVisible();
    // 入力途中のキーも消える
    await keyField(page).fill(DUMMY_KEY);
    await expect(generateButton(page)).toBeEnabled();
    await clearKeyButton(page).click();
    await expect(keyField(page)).toHaveValue("");
    await expect(generateButton(page)).toBeDisabled();
    // 消したあとに、Gemini へは新しい通信が出ていない
    expect(gemini.length).toBe(1);
  });
});

test.describe("通信先", () => {
  test("許可した宿（このサイトと Gemini）以外へは通信しない（LP・デモ・生成まで）", async ({ page }) => {
    const hosts = new Set<string>();
    page.on("request", (request) => {
      const url = new URL(request.url());
      // data: や blob: は通信ではない
      if (url.protocol === "http:" || url.protocol === "https:") hosts.add(url.host);
    });
    await mockGemini(page, respondSuccess());
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await loadSampleData(page);
    await enterKeyAndGenerate(page);
    await expect(page.getByText(SUCCESS_SUMMARY)).toBeVisible({ timeout: 20_000 });

    const unexpected = [...hosts].filter((host) => host !== DEMO_HOST && host !== GEMINI_HOST);
    expect(unexpected, "許可していない宿への通信").toEqual([]);
    expect(hosts.has(GEMINI_HOST), "Gemini への通信が実際に出ている").toBe(true);
  });

  test("Gemini へ送る内容：キーはヘッダだけ・URL と本文に載せない／顧客ID・明細の行は送らない", async ({ page }) => {
    const gemini = await mockGemini(page, respondSuccess());
    await loadSampleData(page);
    await enterKeyAndGenerate(page);
    await expect(page.getByText(SUCCESS_SUMMARY)).toBeVisible({ timeout: 20_000 });
    expect(gemini.length).toBe(1);

    const [sent] = gemini;
    // キー：x-goog-api-key のヘッダ。URL・本文には載せない
    expect(sent.headers["x-goog-api-key"]).toBe(DUMMY_KEY);
    expect(sent.url).not.toContain(DUMMY_KEY);
    expect(sent.url).not.toMatch(/[?&]key=/);
    expect(sent.body ?? "").not.toContain(DUMMY_KEY);
    // 送り先は Google の generateContent だけ
    expect(new URL(sent.url).host).toBe(GEMINI_HOST);

    // 本文は集計値だけ：顧客ID・明細の行（日付つきの注文）は入っていない
    const body = sent.body ?? "";
    expect(body.length).toBeGreaterThan(0);
    expect(body).not.toMatch(/customer_?id/i);
    expect(body).not.toContain("CUST-");
    expect(body).not.toContain("顧客ID");
    expect(body).not.toMatch(/orderDate|order_date|注文日/);
    // 注文の日付（YYYY-MM-DD）は行データにしか出ない。集計は YYYY-MM までしか持たない
    expect(body).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    // 集計値は入っている（空の送信ではない）
    expect(body).toContain("2025");
  });
});
