import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

// .mts（ES モジュール）にしているのは、CommonJS として読まれる警告を出さないため
export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    // .env.local の値をテストの環境変数として渡す（値は出力しない）。
    // 権限テストは実際の検証用 Supabase に接続するため、少し長めに待つ
    env: loadEnv(mode, process.cwd(), ""),
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
}));
