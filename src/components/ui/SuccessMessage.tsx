import { CircleCheck } from "lucide-react";

// 画面の中の成功・完了の知らせ（緑の面＋アイコン）。読み上げでも伝わるよう role="status"
export function SuccessMessage({ children }: { children: string }) {
  return (
    <p role="status" className="flex items-start gap-2 rounded-control bg-up-soft px-3 py-2.5 text-body text-up">
      <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
