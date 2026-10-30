import { Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "@/components/ui/cx";

type Props = {
  // info：読んでおいてほしい注意／caution：今の状態で気をつけること（保存先が切り替わったときなど）
  tone: "info" | "caution";
  children: ReactNode;
  className?: string;
};

// デモ版の注意書き（色の面＋線アイコン）。色は @theme の名前だけを使う
export function DemoNotice({ tone, children, className }: Props) {
  const Icon = tone === "caution" ? TriangleAlert : Info;
  return (
    <div
      className={cx(
        "flex items-start gap-2 rounded-control px-3 py-2.5 text-body",
        tone === "caution" ? "bg-caution-soft text-caution" : "bg-chart-5/60 text-brand-navy",
        className,
      )}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
