import type { SupabaseClient } from "@supabase/supabase-js";
import { Suspense } from "react";
import { AnalysisPanel } from "@/components/analysis/AnalysisPanel";
import {
  DASHBOARD_DESCRIPTION,
  DASHBOARD_TITLE,
  DashboardReport,
} from "@/components/dashboard/DashboardReport";
import { PageHeader } from "@/components/layout/PageHeader";
import { AlertMessage } from "@/components/ui/AlertMessage";
import { loadLatestReport } from "@/lib/analysis/load";
import { loadSalesRows } from "@/lib/aggregate";
import { requireMember } from "@/lib/auth/guard";

// ダッシュボード（T-21 デザイン・T-22 KPIカードと月の選択・T-23 推移グラフ・T-25 カテゴリ別と売れ筋）
// セッションを読む部分は <Suspense> の中に置く（Cache Components の決まり）
export default function DashboardPage({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<p className="p-4 text-body text-ink-muted">読み込み中…</p>}>
      <DashboardContent searchParams={searchParams} />
    </Suspense>
  );
}

async function DashboardContent({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  // 最初に requireMember()：未ログイン・停止中・パスワード未変更はここで止まる
  const member = await requireMember();
  const { month, period } = await searchParams;
  // 数字はすべて @/lib/aggregate の結果。画面では計算し直さない
  const loaded = await loadSalesRows(member.supabase, member.shopId);

  return (
    <main className="flex-1 px-4 py-6 md:px-8">
      <div className="flex max-w-6xl flex-col gap-5">
        {loaded.ok ? (
          <DashboardReport
            rows={loaded.rows}
            requestedMonth={month}
            requestedPeriod={period}
            renderAnalysis={(selectedMonth) => (
              <AnalysisSection db={member.supabase} shopId={member.shopId} month={selectedMonth} />
            )}
          />
        ) : (
          <>
            <PageHeader title={DASHBOARD_TITLE} description={DASHBOARD_DESCRIPTION} />
            <AlertMessage>{loaded.error}</AlertMessage>
          </>
        )}
      </div>
    </main>
  );
}

// AI分析コメントの区画。最新の分析をここで読む（読めない・壊れた時は「まだありません」＝KPI・グラフには影響しない）
async function AnalysisSection({ db, shopId, month }: { db: SupabaseClient; shopId: string; month: string }) {
  const latest = await loadLatestReport(db, shopId, month);
  return (
    <AnalysisPanel
      key={month}
      month={month}
      latest={latest ? { report: latest.report, generatedAt: latest.generatedAt } : null}
    />
  );
}

