import { defineConfig, devices } from "@playwright/test";

// 画面確認・スクショ（architecture.md 第7項）
// 開発サーバーが動いていなければ、テストの前に自動で起動する
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  // 同時実行は 1 にする。検証用 Supabase のログインには回数の上限（IPごとに5分150回・瞬間30回）があり、
  // 並列だとテストのログインが 429（over_request_rate_limit）になって落ちるため。コードの不具合ではない
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
  },
  projects: [
    { name: "pc", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    { name: "sp", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
