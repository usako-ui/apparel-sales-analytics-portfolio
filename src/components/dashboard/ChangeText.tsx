import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { cx } from "@/components/ui/cx";
import type { ChangeTone, ChangeView } from "@/lib/format";

const toneView: Record<ChangeTone, { className: string; icon: typeof Minus }> = {
  up: { className: "text-up", icon: TrendingUp },
  down: { className: "text-down", icon: TrendingDown },
  flat: { className: "text-flat", icon: Minus },
};

// 前月比・前月差の1行。増加＝緑／減少＝赤／0%＝グレー。色だけに頼らず、＋／−の記号と矢印の線アイコンも付ける。
// 計算できない時は「—」。その理由は KpiCard の note に出す（view.reason）
export function ChangeText({ label, view }: { label: string; view: ChangeView }) {
  const tone = view.tone === null ? null : toneView[view.tone];
  const Icon = tone?.icon;
  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <span className={cx("inline-flex items-center gap-1 font-semibold", tone?.className)}>
        {Icon ? <Icon aria-hidden="true" className="size-4" /> : null}
        {view.text ?? "—"}
      </span>
    </span>
  );
}
