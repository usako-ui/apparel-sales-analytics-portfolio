import { CircleAlert, CircleCheck, ListChecks, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import type { StoredReport } from "@/lib/analysis/schema";
import { describeWarningField, formatGeneratedAt, PRIORITY_VIEW } from "./analysis-view";

type Props = {
  report: StoredReport;
  /** ISO 形式の生成日時 */
  generatedAt: string;
};

// 保存済みの分析コメントの表示（まとめ・注目点・気になる点・打ち手）。表示だけで、計算はしない
export function ReportBody({ report, generatedAt }: Props) {
  const generatedLabel = formatGeneratedAt(generatedAt);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Badge tone="caution">AI生成・要確認</Badge>
        {generatedLabel ? <span className="text-caption text-ink-muted">{generatedLabel} に生成</span> : null}
      </div>

      {report.numberWarnings.length > 0 ? <NumberWarnings warnings={report.numberWarnings} /> : null}

      <p className="text-body leading-relaxed text-ink">{report.summary}</p>

      <Section title="注目点" icon={<CircleCheck aria-hidden="true" className="size-4 shrink-0 text-up" />}>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 marker:text-ink-muted">
          {report.highlights.map((text, i) => (
            <li key={i}>{text}</li>
          ))}
        </ul>
      </Section>

      <Section title="気になる点" icon={<CircleAlert aria-hidden="true" className="size-4 shrink-0 text-caution" />}>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 marker:text-ink-muted">
          {report.concerns.map((text, i) => (
            <li key={i}>{text}</li>
          ))}
        </ul>
      </Section>

      <Section title="来月の打ち手" icon={<ListChecks aria-hidden="true" className="size-4 shrink-0 text-brand-navy" />}>
        <ul className="flex flex-col gap-2.5">
          {report.actions.map((item, i) => {
            const view = PRIORITY_VIEW[item.priority];
            return (
              <li key={i} className="flex flex-col items-start gap-1 sm:flex-row sm:gap-3">
                <span
                  className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-caption font-semibold ${view.className}`}
                >
                  {view.label}
                </span>
                <span>{item.action}</span>
              </li>
            );
          })}
        </ul>
      </Section>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-t border-line pt-4 text-body text-ink">
      <h3 className="flex items-center gap-2 font-bold text-brand-navy">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

// 数字の照合で、集計値と合わなかった数値。コメントは消さずに、確認を促す
function NumberWarnings({ warnings }: { warnings: StoredReport["numberWarnings"] }) {
  return (
    <div role="alert" className="flex flex-col gap-2 rounded-control bg-caution-soft px-3 py-2.5 text-body text-caution">
      <p className="flex items-start gap-2 font-bold">
        <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        数字を確認してください
      </p>
      <p>次の数値が、集計した数字と一致しませんでした。内容を確かめてから使ってください。</p>
      <ul className="flex list-disc flex-col gap-0.5 pl-5">
        {warnings.map((warning, i) => {
          const place = describeWarningField(warning.field);
          return (
            <li key={i}>
              <span className="font-semibold">{warning.text}</span>
              {place ? <span>（{place}）</span> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
