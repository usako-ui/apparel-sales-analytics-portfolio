import type { LucideIcon } from "lucide-react";
import { useId, type ReactNode } from "react";
import { cx } from "./cx";

type Props = {
  title: string;
  // 見出しの左の線アイコン
  icon: LucideIcon;
  // 見出しの右に置く操作・ラベル（期間の切替・「分析を生成」など）
  action?: ReactNode;
  className?: string;
  children: ReactNode;
};

// 白いカード（見出し＋内容）。グラフ・表・AIコメントなど、ダッシュボードの区画で共通に使う
export function Panel({ title, icon: Icon, action, className, children }: Props) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className={cx("flex min-w-0 flex-col gap-4 rounded-card bg-surface p-5 shadow-card", className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 id={titleId} className="flex items-center gap-2 text-heading font-bold text-brand-navy">
          <Icon aria-hidden="true" className="size-5 shrink-0" />
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

// 中身がまだ入っていない区画の枠（点線）。中身ができたら使わなくなる
export function PanelPlaceholder({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        "flex min-h-40 items-center justify-center rounded-control border border-dashed border-line-strong px-4 text-center text-body text-ink-muted",
        className,
      )}
    >
      {children}
    </div>
  );
}
