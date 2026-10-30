"use client";

import { Upload } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import type { ShownReport } from "@/components/analysis/AnalysisPanelView";
import { DashboardReport } from "@/components/dashboard/DashboardReport";
import { PageHeader } from "@/components/layout/PageHeader";
import { buttonClass } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import type { SalesRow } from "@/lib/csv/validate";
import { createKeyHolder } from "../lib/key-holder";
import { type AnalysisNotice, DemoAnalysisPanel, EMPTY_NOTICE } from "./DemoAnalysisPanel";

export const DEMO_PATH = "/demo";
export const DEMO_DATA_ANCHOR = "demo-data";

type Props = {
  rows: SalesRow[];
};

// デモ版のダッシュボード。保存済みの行を DashboardReport に渡す。月・期間は /demo?month=…&period=… で選ぶ
// useSearchParams を使うため、呼び出し側で <Suspense> に入れる
export function DemoDashboard({ rows }: Props) {
  const searchParams = useSearchParams();
  // キーと生成結果はメモリだけ。AI 分析の部品は月ごとに作り直されるため、月を切り替えても残るようここで持つ
  const [keyHolder] = useState(createKeyHolder);
  const [reports, setReports] = useState<Record<string, ShownReport>>({});
  // 入力途中のキー（メモリの state だけ。storage・URL・Cookie・console には出さない）
  const [keyInput, setKeyInput] = useState("");
  // 生成中の月（ページ全体で1つ）。ref は同じ描画内の連続クリックを止めるため
  const [generatingMonth, setGeneratingMonth] = useState<string | null>(null);
  const generatingRef = useRef(false);
  // 月ごとの失敗・成功の案内。生成中に別の月へ移っても、元の月に戻ると見えるようここで持つ
  const [notices, setNotices] = useState<Record<string, AnalysisNotice>>({});

  function handleGenerateStart(month: string): boolean {
    if (generatingRef.current) return false;
    generatingRef.current = true;
    setGeneratingMonth(month);
    return true;
  }

  function handleGenerateEnd() {
    generatingRef.current = false;
    setGeneratingMonth(null);
  }

  if (rows.length === 0) {
    return (
      <>
        <PageHeader title="ダッシュボード" description="アパレルECの売上分析" />
        <Panel title="売上データがまだありません" icon={Upload}>
          <p className="text-body text-ink-muted">
            「ダミーCSVで試す」を押すと、用意してあるダミーの売上データで、売上・粗利・リピート率と推移グラフを見られます。自分のダミーCSVを選んでもかまいません。
          </p>
          <div>
            <Link href={`#${DEMO_DATA_ANCHOR}`} className={buttonClass("secondary")}>
              データの区画へ移動
            </Link>
          </div>
        </Panel>
      </>
    );
  }

  return (
    <DashboardReport
      rows={rows}
      requestedMonth={searchParams.get("month") ?? undefined}
      requestedPeriod={searchParams.get("period") ?? undefined}
      basePath={DEMO_PATH}
      renderAnalysis={(month) => (
        <DemoAnalysisPanel
          month={month}
          rows={rows}
          keyHolder={keyHolder}
          keyInput={keyInput}
          onKeyInputChange={setKeyInput}
          generatingMonth={generatingMonth}
          onGenerateStart={handleGenerateStart}
          onGenerateEnd={handleGenerateEnd}
          latest={reports[month] ?? null}
          notice={notices[month] ?? EMPTY_NOTICE}
          onNoticeChange={(noticeMonth, notice) => setNotices((current) => ({ ...current, [noticeMonth]: notice }))}
          onReport={(reportMonth, shown) => setReports((current) => ({ ...current, [reportMonth]: shown }))}
        />
      )}
    />
  );
}
