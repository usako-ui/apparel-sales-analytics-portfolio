import { defineConfig, devices } from "@playwright/test";

// デモ版（demo/）の画面確認。本番用の playwright.config.ts とは別（ポート 3100・別の開発サーバー）
// 実行：npm run test:demo-e2e
// 本物の Gemini は呼ばない（通信は page.route でモックする）
export default defineConfig({
  testDir: "tests/demo-e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3100",
  },
  projects: [
    { name: "pc", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    { name: "sp", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: "npm run dev --workspace=demo -- --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
