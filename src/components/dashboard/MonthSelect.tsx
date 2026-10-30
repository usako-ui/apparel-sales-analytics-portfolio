"use client";

import { CalendarDays, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatMonthLabel } from "@/components/upload/month-label";
import { dashboardHref, type PeriodKind } from "./select-month";

type Props = {
  // 選べる月（データのある月・YYYY-MM）。並びはこの順のまま
  months: readonly string[];
  selected: string;
  // カテゴリ別・売れ筋の期間の選択。月を変えても残す
  period: PeriodKind;
  // 移動先の画面（本番は "/"、デモ版は "/demo"）
  basePath?: string;
};

// 表示する月の選択（見出しの右）。選ぶと {basePath}?month=YYYY-MM&period=... へ移る（受け取った側で確かめ直す）
export function MonthSelect({ months, selected, period, basePath = "/" }: Props) {
  const router = useRouter();
  return (
    <div className="relative inline-flex min-h-11 items-center rounded-control border border-line-strong bg-surface shadow-card focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus">
      <CalendarDays aria-hidden="true" className="pointer-events-none absolute left-3 size-5 text-brand-navy" />
      <select
        aria-label="表示する月"
        value={selected}
        onChange={(event) => router.push(dashboardHref(event.target.value, period, basePath))}
        className="min-h-11 cursor-pointer appearance-none rounded-control bg-transparent py-2 pr-10 pl-10 text-body font-semibold text-ink outline-none"
      >
        {months.map((month) => (
          <option key={month} value={month}>
            {formatMonthLabel(month)}
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 size-4 text-ink-muted" />
    </div>
  );
}
