import { ChartColumn, ChartLine, Coins, Repeat, ShoppingCart, Sparkles, Trophy, Upload } from "lucide-react";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { CategoryChart } from "@/components/dashboard/CategoryChart";
import { ChangeText } from "@/components/dashboard/ChangeText";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { MonthSelect } from "@/components/dashboard/MonthSelect";
import { PeriodToggle } from "@/components/dashboard/PeriodToggle";
import { pickMonth, pickPeriodKind, toDisplayPeriod } from "@/components/dashboard/select-month";
import { SkuTable } from "@/components/dashboard/SkuTable";
import { toTrendPoints } from "@/components/dashboard/trend-data";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { TrendLegend } from "@/components/dashboard/TrendLegend";
import { PageHeader } from "@/components/layout/PageHeader";
import { buttonClass } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import {
  calcCategorySales,
  calcMonthlyKpis,
  calcMonthlyRepeat,
  calcRepeatOverall,
  calcSkuTop,
  explainReason,
} from "@/lib/aggregate";
import type { SalesRow } from "@/lib/csv/validate";
import { formatPercent, formatYen, viewChange } from "@/lib/format";

export const DASHBOARD_TITLE = "ダッシュボード";
export const DASHBOARD_DESCRIPTION = "アパレルECの売上分析";

// 計算できない（null）なら「—」
const withUnit = (text: string | null, unit: string) => (text === null ? "—" : `${text}${unit}`);

export type DashboardQuery = string | string[] | undefined;

export type DashboardReportProps = {
  rows: SalesRow[];
  // URL の ?month=・?period= の値（不正な値は中で確かめ直す）
  requestedMonth: DashboardQuery;
  requestedPeriod: DashboardQuery;
  // AI分析の区画。表示している月（YYYY-MM）を受け取って中身を返す。
  // 本番はサーバーで保存済みの分析を読む部品、デモはブラウザ内の部品を渡す
  renderAnalysis: (month: string) => ReactNode;
  // 月・期間の移動先（本番は "/"、デモ版は "/demo"）。省略時は "/"
  basePath?: string;
};

// ダッシュボードの画面の組み立て（KPI・グラフ・カテゴリ別・売れ筋・AI分析の置き場）。
// サーバー専用のもの（Supabase・next/headers・認証）は import しない。データの読み込みと AI 区画は呼び出し側が渡す
export function DashboardReport({ rows, requestedMonth, requestedPeriod, renderAnalysis, basePath = "/" }: DashboardReportProps) {
  const kpis = calcMonthlyKpis(rows);
  // 表示する月：URL の ?month= を確かめ、不正な月・データのない月は最新の月（pickMonth）
  const selectedMonth = pickMonth(requestedMonth, kpis.map((k) => k.month));
  const current = kpis.find((k) => k.month === selectedMonth);

  if (current === undefined) {
    // データ0件：何が起きたか → どうすればよいか（アップロードへの案内）
    return (
      <>
        <PageHeader title={DASHBOARD_TITLE} description={DASHBOARD_DESCRIPTION} />
        <Panel title="売上データがまだありません" icon={Upload}>
          <p className="text-body text-ink-muted">CSVをアップロードすると、売上・粗利・リピート率と推移グラフが表示されます。</p>
          <div>
            <Link href="/upload" className={buttonClass("primary")}>
              CSVをアップロードする
            </Link>
          </div>
        </Panel>
      </>
    );
  }

  // カテゴリ別・売れ筋の表示期間：?period=month なら選んでいる月、それ以外（不正な値を含む）は全期間
  const periodKind = pickPeriodKind(requestedPeriod);
  const displayPeriod = toDisplayPeriod(periodKind, current.month);
  const categories = calcCategorySales(rows, displayPeriod);
  const skuTop = calcSkuTop(rows, displayPeriod);
  // 「選択した月」のボタンには月を出す（推移グラフの軸と同じ書き方：同じ年なら「11月」）
  const monthLabel = toTrendPoints(kpis).find((p) => p.month === current.month)?.label ?? current.month;
  const periodToggle = (
    <PeriodToggle selected={periodKind} month={current.month} monthLabel={monthLabel} basePath={basePath} />
  );

  const repeat = calcMonthlyRepeat(rows).find((r) => r.month === current.month);
  const overall = calcRepeatOverall(rows);
  const repeatValue = formatPercent(repeat?.rate.ratio ?? null);
  const revenueChange = viewChange(current.revenueChange, "%");
  const grossProfitChange = viewChange(current.grossProfitChange, "%");
  const repeatChange = repeat ? viewChange(repeat.changePoints, "pt") : null;
  // リピート率そのものが出せない月は、その理由を出す（前月差の理由より先）
  const repeatRateReason = repeat?.rate.reason ? explainReason(repeat.rate.reason) : null;

  return (
    <>
      <PageHeader
        title={DASHBOARD_TITLE}
        description={DASHBOARD_DESCRIPTION}
        // 選べるのはデータのある月だけ。新しい月が上
        action={
          <MonthSelect
            months={kpis.map((k) => k.month).reverse()}
            selected={current.month}
            period={periodKind}
            basePath={basePath}
          />
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <KpiCard
          label="売上"
          icon={ShoppingCart}
          value={formatYen(current.revenue)}
          unit="円"
          footer={<ChangeText label="前月比" view={revenueChange} />}
          note={revenueChange.reason}
        />
        <KpiCard
          label="粗利"
          icon={Coins}
          value={formatYen(current.grossProfit)}
          unit="円"
          footer={<ChangeText label="前月比" view={grossProfitChange} />}
          note={grossProfitChange.reason}
        />
        <KpiCard
          label="リピート率"
          icon={Repeat}
          value={repeatValue ?? "—"}
          unit={repeatValue === null ? "" : "%"}
          footer={repeatChange ? <ChangeText label="前月比" view={repeatChange} /> : null}
          aside={<span>期間全体 {withUnit(formatPercent(overall.rate.ratio), "%")}</span>}
          note={repeatRateReason ?? repeatChange?.reason ?? null}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* 推移は月単位のグラフなので、選んでいる月に関わらず、データのある全月を出す */}
        <Panel title="月次推移（売上・粗利）" icon={ChartLine} action={<TrendLegend />} className="lg:col-span-3">
          <TrendChart points={toTrendPoints(kpis)} />
        </Panel>
        <Panel title="カテゴリ別売上" icon={ChartColumn} action={periodToggle} className="lg:col-span-2">
          <CategoryChart items={categories} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="売れ筋商品トップ10" icon={Trophy} action={periodToggle}>
          <SkuTable items={skuTop} />
        </Panel>
        {/* 月を変えたら key で作り直し、前の月の失敗表示などを引き継がない */}
        <Suspense
          key={current.month}
          fallback={
            <Panel title="AI分析コメント" icon={Sparkles}>
              <p className="text-body text-ink-muted">読み込み中…</p>
            </Panel>
          }
        >
          {renderAnalysis(current.month)}
        </Suspense>
      </div>
    </>
  );
}
