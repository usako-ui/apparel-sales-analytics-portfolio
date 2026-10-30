"use client"; // エラー画面は Client Component にする決まり

import { ErrorScreen } from "@/components/layout/ErrorScreen";

// 想定外の例外の画面（共通レイアウト・ログイン画面など、(app) の中の error.tsx で受けられないもの）。
// error の中身は画面に出さない。retry は、この区画を読み込み直す（Next.js 16.3 以降の正式な props）
export default function RootError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorScreen onRetry={retry} />;
}
