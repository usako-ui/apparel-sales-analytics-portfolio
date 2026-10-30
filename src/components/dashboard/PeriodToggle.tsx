import Link from "next/link";
import { cx } from "@/components/ui/cx";
import { formatMonthLabel } from "@/components/upload/month-label";
import { dashboardHref, type PeriodKind } from "./select-month";

type Props = {
  selected: PeriodKind;
  // 「選択した月」にした時に残す月（YYYY-MM）。KPI の月と同じ
  month: string;
  // ボタンに出す月の文字（「11月」。年をまたぐ時は「2025年11月」＝推移グラフの軸と同じ書き方）
  monthLabel: string;
  // 移動先の画面（本番は "/"、デモ版は "/demo"）
  basePath?: string;
};

const pill = "inline-flex min-h-11 items-center md:min-h-9 rounded-full px-3.5 text-caption font-semibold transition-colors";

// 表示期間の切り替え（全期間／選択した月）。リンクなので画面の準備を待たずに使える。
// カテゴリ別と売れ筋の両方の見出しに置き、どちらを押しても両方が切り替わる（同じ URL の ?period=）
export function PeriodToggle({ selected, month, monthLabel, basePath = "/" }: Props) {
  // 見える文字は「全期間」「11月」。読み上げの名前は、見える文字を含む説明にする
  const options: { kind: PeriodKind; label: string; name: string }[] = [
    { kind: "all", label: "全期間", name: "全期間" },
    { kind: "month", label: monthLabel, name: `選択した月（${formatMonthLabel(month)}）` },
  ];
  return (
    <nav aria-label="表示期間" className="flex items-center gap-1.5">
      {options.map(({ kind, label, name }) => (
        <Link
          key={kind}
          href={dashboardHref(month, kind, basePath)}
          aria-label={name}
          aria-current={selected === kind ? "true" : undefined}
          scroll={false}
          className={cx(
            pill,
            selected === kind
              ? "bg-brand-navy text-on-navy"
              : "border border-line-strong bg-surface text-brand-navy hover:bg-brand-light",
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
