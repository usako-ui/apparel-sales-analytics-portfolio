import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Apparel Analytics｜AI 売上分析ダッシュボード（デモ）",
  description: "アパレル EC の売上 CSV から、月次の売上・粗利・リピート率・AI の分析コメントまで作るダッシュボードの紹介とデモ版です。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
