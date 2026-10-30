// デモ版の e2e の共通の道具。本物の Gemini は呼ばず、通信は page.route でモックする。キーはダミーの文字列だけ
import { expect, type Page, type Route } from "@playwright/test";
import { analysisResultSchema, type AnalysisResult } from "../../src/lib/analysis/schema";

export const DUMMY_KEY = "test-key-DUMMY";
export const GEMINI_HOST = "generativelanguage.googleapis.com";
export const DEMO_HOST = "localhost:3100";
export const STORE_KEY = "lumina-demo-sales-v1";

// 成功の応答に使う分析（本物の型で検証する）。数字を書かない文にして、数字の照合の警告が出ないようにしている
export const successResult: AnalysisResult = analysisResultSchema.parse({
  summary: "アウターが売上を引っぱり、全体として前月より伸びた月でした。",
  highlights: ["アウターが最も大きい売上になった", "リピート購入が前月より増えた", "粗利も売上と同じ方向に伸びた"],
  concerns: ["小物の売上が小さく、構成比が低い", "新規購入者への依存が残っている"],
  actions: [
    { priority: "high", action: "アウターの購入者へ、組み合わせ提案を送る" },
    { priority: "medium", action: "初回購入者向けのフォローを翌月に実施する" },
  ],
});

export const SUCCESS_SUMMARY = successResult.summary;

export type CapturedRequest = {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string | null;
};

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*, x-goog-api-key, content-type, x-goog-api-client, x-goog-user-project",
  "access-control-allow-methods": "POST, OPTIONS",
};

export type Responder = (route: Route) => Promise<void> | void;

/** Gemini の本物の応答の形（candidates の中に文）で、成功を返す */
export const respondSuccess =
  (text: string = JSON.stringify(successResult)): Responder =>
  (route) =>
    route.fulfill({
      status: 200,
      headers: CORS_HEADERS,
      contentType: "application/json",
      body: JSON.stringify({
        candidates: [{ content: { role: "model", parts: [{ text }] }, finishReason: "STOP", index: 0 }],
        usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 80, totalTokenCount: 200 },
      }),
    });

/** Google のエラーの形で、状態コードの失敗を返す（本文の文は、画面に出てはいけない目印つき） */
export const respondError =
  (status: number): Responder =>
  (route) =>
    route.fulfill({
      status,
      headers: CORS_HEADERS,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: status, message: "GOOGLE-RAW-ERROR-MESSAGE", status: "ERROR_STATUS" } }),
    });

/** 通信そのものの失敗（接続できない） */
export const respondNetworkFailure: Responder = (route) => route.abort("failed");

/**
 * Gemini への通信（generativelanguage.googleapis.com）をモックにし、届いたリクエストを配列に貯める。
 * 事前確認（OPTIONS）は貯めずに通す
 */
export async function mockGemini(page: Page, respond: Responder): Promise<CapturedRequest[]> {
  const captured: CapturedRequest[] = [];
  await page.route(`https://${GEMINI_HOST}/**`, async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    captured.push({
      method: request.method(),
      url: request.url(),
      headers: request.headers(),
      body: request.postData(),
    });
    await respond(route);
  });
  return captured;
}

/** /demo を開き、「ダミーCSVで試す」→「取り込む」でダッシュボードを出す */
export async function loadSampleData(page: Page) {
  await page.goto("/demo");
  // 画面の準備（ハイドレーション）前に押すと無視されるため、取り込みの確認が出るまで押し直す
  await expect(async () => {
    await page.getByRole("button", { name: "ダミーCSVで試す" }).click();
    await expect(page.getByRole("button", { name: "取り込む" })).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 20_000 });
  await page.getByRole("button", { name: "取り込む" }).click();
  await expect(page.getByRole("heading", { name: "AI分析コメント" })).toBeVisible({ timeout: 20_000 });
}

export const keyField = (page: Page) => page.getByLabel("Gemini API キー", { exact: true });
export const generateButton = (page: Page) => page.getByRole("button", { name: "分析を生成" });
export const clearKeyButton = (page: Page) => page.getByRole("button", { name: "キーを消す" });

/** キーを入力して「分析を生成」を押す */
export async function enterKeyAndGenerate(page: Page, key: string = DUMMY_KEY) {
  await keyField(page).fill(key);
  await generateButton(page).click();
}

/** ページの横幅が画面の幅を超えた量（0 以下なら横ずれなし） */
export const horizontalOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
