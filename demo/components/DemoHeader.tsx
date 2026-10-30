import Link from "next/link";
import { Logo } from "@/components/layout/Logo";
import { Badge } from "@/components/ui/Badge";
import { DemoNotice } from "./DemoNotice";

// デモ版の上部：ロゴ・「デモ版」のバッジ・使う前の注意書き。サーバー側で描画する（状態を持たない）
export function DemoHeader() {
  return (
    <header className="bg-surface shadow-card">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <Logo tone="onLight" />
            <Badge tone="navy">デモ版</Badge>
          </div>
          <Link href="/" className="text-body font-semibold text-brand-navy underline underline-offset-2">
            紹介ページに戻る
          </Link>
        </div>
        <DemoNotice tone="info">
          <ul className="flex list-disc flex-col gap-1 pl-4">
            <li>ダミーのデータだけで試してください。</li>
            <li>データはこのブラウザにだけ保存されます。</li>
            <li>「データを消す」ボタンで、このブラウザに保存したデータを削除できます。</li>
            <li>AI分析は、閲覧者自身の Gemini キーで動きます（準備中）。</li>
          </ul>
        </DemoNotice>
      </div>
    </header>
  );
}
