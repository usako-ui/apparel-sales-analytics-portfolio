import { TriangleAlert } from "lucide-react";

// 画面の中のエラー・警告の文（赤い面＋アイコン）。「何が起きたか → どうすればよいか」の文を渡す
export function AlertMessage({ children }: { children: string }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-control bg-down-soft px-3 py-2.5 text-body text-down"
    >
      <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
