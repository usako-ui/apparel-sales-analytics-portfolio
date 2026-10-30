import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // create-next-app 16.4.3 の初期値のまま（T-06 で認証と合わせて公式ドキュメントで確認する）
  cacheComponents: true,
  partialPrefetching: true,
  // スクショ撮影用：開発中の「N」マークを消す（開発サーバーの表示だけに効く）
  devIndicators: false,
  experimental: {
    serverActions: {
      // 既定は 1MB。CSV の上限 5MB（requirements.md 第20項）＋multipart の余白（公式：10〜20KB 程度）より大きくする。
      // 5MB の判定は lib/upload/import.ts で行い、日本語のメッセージを返す
      bodySizeLimit: "6mb",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // クリックジャッキング対策（他サイトに透明に重ねて押させる攻撃を防ぐ）。
  // 送り先を絞る CSP（connect-src・script-src など）は Supabase・グラフ・Next.js の動きを止めるおそれがあるため入れない（v1.0 の候補）
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
    ];
  },
};

export default nextConfig;
