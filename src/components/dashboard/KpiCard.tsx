import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  label: string;
  icon: LucideIcon;
  // 大きな数字と、その後ろの小さな単位（「円」「%」）
  value: string;
  unit: string;
  // 数字の下の行（前月比など）。中身の色分け・「—」の説明は呼び出し側（T-22）で決める
  footer?: ReactNode;
  // 数字の下の行の右側に、縦線で区切って置く補足（リピート率の「期間全体」）
  aside?: ReactNode;
  // 「—」にした理由など、短い補足（下の行）
  note?: string | null;
};

// KPIカード：左に線アイコン、縦線をはさんで 名前・大きな数字・下の行
export function KpiCard({ label, icon: Icon, value, unit, footer, aside, note }: Props) {
  return (
    <section aria-label={label} className="flex items-center gap-4 rounded-card bg-surface p-5 shadow-card">
      <Icon aria-hidden="true" className="size-10 shrink-0 text-brand-navy" strokeWidth={1.5} />
      <div aria-hidden="true" className="h-14 w-px shrink-0 bg-line" />
      <div className="min-w-0 flex-1">
        <p className="text-body font-semibold text-ink">{label}</p>
        <p className="mt-0.5 flex items-baseline gap-1 text-brand-navy">
          <span className="text-kpi font-bold tabular-nums">{value}</span>
          <span className="text-body font-semibold">{unit}</span>
        </p>
        {footer || aside ? (
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-body text-ink-muted">
            {footer}
            {/* 縦線は補足の左側の枠線。折り返した時も、線が行末に残らない */}
            {aside ? <span className="border-l border-line-strong pl-3">{aside}</span> : null}
          </div>
        ) : null}
        {note ? <p className="mt-1 text-caption text-ink-muted">{note}</p> : null}
      </div>
    </section>
  );
}
