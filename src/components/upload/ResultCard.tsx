import { CircleCheck, Download, FileCheck, FileText } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { formatMonthLabel } from "./month-label";

type Props = {
  // preview：取り込む前の確認（まだ保存していない）／imported：取り込み済み
  mode: "preview" | "imported";
  fileName: string;
  successCount: number;
  skippedCount: number;
  // 対象月（YYYY-MM）と、そのうち上書きになる月
  months: string[];
  overwriteMonths: string[];
  onDownloadSkipped: () => void;
  // カードの下に並べる操作・メッセージ（「取り込む」・成功の知らせなど）
  children?: ReactNode;
};

// 取込結果のカード：ファイル名・○行成功／×行スキップ・対象月・スキップ行のダウンロード
export function ResultCard({
  mode,
  fileName,
  successCount,
  skippedCount,
  months,
  overwriteMonths,
  onDownloadSkipped,
  children,
}: Props) {
  const Icon = mode === "imported" ? CircleCheck : FileCheck;

  return (
    <section aria-labelledby="result-title" className="flex flex-col gap-4 rounded-card bg-surface p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Icon aria-hidden="true" className={cx("mt-0.5 size-8 shrink-0", mode === "imported" ? "text-up" : "text-brand-navy")} />
          <div className="min-w-0">
            <h2 id="result-title" className="text-heading font-bold text-brand-navy">
              {mode === "imported" ? "取込結果" : "取り込み前の確認"}
            </h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-caption text-ink-muted">
              <FileText aria-hidden="true" className="size-4 shrink-0" />
              <span className="break-all" data-testid="result-file-name">{fileName}</span>
            </p>
          </div>
        </div>
      </div>

      <p className="flex flex-wrap items-baseline gap-x-3 text-title font-bold" data-testid="result-counts">
        <span className="text-up">{successCount}行 成功</span>
        <span aria-hidden="true" className="text-line-strong">/</span>
        <span className={skippedCount > 0 ? "text-down" : "text-ink-muted"}>{skippedCount}行 スキップ</span>
      </p>

      <div className="flex flex-col gap-1.5">
        <h3 className="text-body font-semibold text-ink">対象月</h3>
        <ul className="flex flex-wrap gap-2" data-testid="result-months">
          {months.map((month) => (
            <li key={month} className="flex items-center gap-1.5">
              <Badge tone="navy">{formatMonthLabel(month)}</Badge>
              {mode === "preview" && overwriteMonths.includes(month) ? <Badge tone="caution">すでにデータあり</Badge> : null}
            </li>
          ))}
        </ul>
      </div>

      {/* 件数・対象月の下に置く（スマホでも PC でも同じ位置） */}
      {skippedCount > 0 ? (
        <div>
          <Button variant="secondary" onClick={onDownloadSkipped}>
            <Download aria-hidden="true" className="size-4" />
            スキップ行をダウンロード
          </Button>
        </div>
      ) : null}

      {children}
    </section>
  );
}
