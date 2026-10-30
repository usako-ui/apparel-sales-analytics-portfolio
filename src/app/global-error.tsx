"use client"; // エラー画面は Client Component にする決まり

import { ErrorScreen } from "@/components/layout/ErrorScreen";
import "./globals.css";

// ルートのレイアウト自身が失敗した時の最後の画面。これが出ると root layout の代わりになるので、html・body を自分で持つ。
// （通常の例外は error.tsx が受ける。これが無いと、この場合だけ Next.js 標準の英語の画面になるため置く）
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <ErrorScreen onRetry={retry} />
      </body>
    </html>
  );
}
