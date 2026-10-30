import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "売上分析ダッシュボード",
  description: "売上CSVから月次のKPI・グラフ・AI分析コメントを作るダッシュボード",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
