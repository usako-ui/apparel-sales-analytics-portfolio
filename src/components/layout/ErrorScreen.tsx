import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";

type Props = {
  // 再読み込み（Next.js の error.tsx が渡す retry）
  onRetry: () => void;
};

// 想定外のエラーの画面（日本語。「何が起きたか → どうすればよいか」）。
// エラーの中身（error.message・スタック）は画面に出さない：技術的な文は分かりにくく、内部の情報が見えてしまうため
export function ErrorScreen({ onRetry }: Props) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div role="alert" className="flex w-full max-w-md flex-col items-center gap-4 rounded-card bg-surface p-8 text-center shadow-card">
        <TriangleAlert aria-hidden="true" className="size-10 text-down" strokeWidth={1.5} />
        <h1 className="text-heading font-bold text-brand-navy">画面を表示できませんでした</h1>
        <p className="text-body text-ink-muted">
          一時的な問題かもしれません。もう一度読み込んでください。
          <br />
          何度もこの画面が出る場合は、管理者に連絡してください。
        </p>
        <Button onClick={onRetry}>もう一度読み込む</Button>
      </div>
    </main>
  );
}
