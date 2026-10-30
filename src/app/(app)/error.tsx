"use client"; // エラー画面は Client Component にする決まり

import { ErrorScreen } from "@/components/layout/ErrorScreen";

// ログイン後の各画面（ダッシュボード・アップロード・管理者・パスワード）で出た想定外の例外の画面。
// (app)/layout.tsx の中に出るので、左メニュー・下のタブは残る（メニューから別の画面へ移れる）。
// レイアウト自身の例外は、この境界の外なので src/app/error.tsx が受ける
export default function AppError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorScreen onRetry={retry} />;
}
