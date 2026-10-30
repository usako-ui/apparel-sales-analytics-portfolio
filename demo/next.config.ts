import path from "node:path";
import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/*
 * 通信先の絞り込み（architecture.md 第18項）
 * - connect-src は自分自身と Google の Gemini API だけ。第三者の解析スクリプトは入れない
 * - script-src：Next.js が画面の初期化にインラインのスクリプトを出すため 'unsafe-inline' が必要。
 *   nonce にするには全ページを動的描画にする必要があり、静的な LP と合わない。
 *   外部のスクリプトは 'self' 以外すべて拒否しているため、読み込み元の絞り込みは保たれる（開発時だけ eval を許可）
 * - style-src：Tailwind が出す CSS と、React のインライン style 属性のため 'unsafe-inline'
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self' https://generativelanguage.googleapis.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  turbopack: {
    // 親フォルダ（リポジトリ直下）まで読めるようにする。../src の共有部品を import するため
    root: path.resolve(import.meta.dirname, ".."),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
