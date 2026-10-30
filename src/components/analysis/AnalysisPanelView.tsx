import { LoaderCircle, Sparkles } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { AlertMessage } from "@/components/ui/AlertMessage";
import { Button, buttonClass } from "@/components/ui/Button";
import { Panel, PanelPlaceholder } from "@/components/ui/Panel";
import { SuccessMessage } from "@/components/ui/SuccessMessage";
import type { StoredReport } from "@/lib/analysis/schema";
import { ReportBody } from "./ReportBody";

export type ShownReport = { report: StoredReport; generatedAt: string };

type Props = {
  /** 表示用の月（例：2025年11月） */
  monthLabel: string;
  /** その月の最新の分析。なければ null（まだ生成していない） */
  latest: ShownReport | null;
  /** 生成の処理中 */
  pending: boolean;
  /** 直前の生成が失敗した時の案内（日本語） */
  errorMessage: string | null;
  /** 失敗の原因がログイン切れ */
  signedOut: boolean;
  /** 直前の生成が成功した */
  justGenerated: boolean;
  onGenerate: () => void;
  /** 説明文の下に差し込む部品（デモ版のキー入力など）。省略時は何も出さない */
  extra?: ReactNode;
  /** 「分析を生成」を押せない理由（日本語の文）。あれば、ボタンを止めて理由を文で出す。省略時は止めない */
  generateBlockedReason?: string | null;
};

const BLOCKED_REASON_ID = "analysis-generate-blocked-reason";

// 「AI分析コメント」の区画の見た目だけ（状態は AnalysisPanel が持つ）。KPI・グラフとは別の区画なので、
// ここが失敗しても他の表示は変わらない（AC-09）
export function AnalysisPanelView({
  monthLabel,
  latest,
  pending,
  errorMessage,
  signedOut,
  justGenerated,
  onGenerate,
  extra,
  generateBlockedReason,
}: Props) {
  const blocked = Boolean(generateBlockedReason);
  return (
    <Panel
      title="AI分析コメント"
      icon={Sparkles}
      action={
        <Button
          variant="primary"
          onClick={onGenerate}
          disabled={pending || blocked}
          aria-busy={pending}
          aria-describedby={blocked ? BLOCKED_REASON_ID : undefined}
        >
          {pending ? (
            <>
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
              生成中…
            </>
          ) : (
            "分析を生成"
          )}
        </Button>
      }
    >
      <p className="-mt-2 text-caption text-ink-muted">{monthLabel}の売上をもとにしたコメントです。</p>

      {extra}

      {blocked && !pending ? (
        <p id={BLOCKED_REASON_ID} className="text-caption text-ink-muted">
          {generateBlockedReason}
        </p>
      ) : null}

      {pending ? (
        <p role="status" className="flex items-center gap-2 text-body text-ink-muted">
          <LoaderCircle aria-hidden="true" className="size-4 shrink-0 animate-spin" />
          {monthLabel}の売上を分析しています。そのまま少しお待ちください。
        </p>
      ) : null}

      {errorMessage ? (
        <div className="flex flex-col items-start gap-3">
          <div className="w-full">
            <AlertMessage>{errorMessage}</AlertMessage>
          </div>
          {signedOut ? (
            <Link href="/login" className={buttonClass("primary")}>
              ログイン画面へ
            </Link>
          ) : null}
        </div>
      ) : null}

      {justGenerated && !pending && !errorMessage ? (
        <SuccessMessage>分析を生成しました。数字と内容を確かめてから共有してください。</SuccessMessage>
      ) : null}

      {latest ? (
        <ReportBody report={latest.report} generatedAt={latest.generatedAt} />
      ) : pending ? null : (
        <PanelPlaceholder className="flex-col gap-1">
          <p className="font-semibold text-ink">{monthLabel}の分析コメントは、まだありません。</p>
          <p>「分析を生成」を押すと、売上・粗利・リピート率などをもとにコメントを作ります。</p>
        </PanelPlaceholder>
      )}
    </Panel>
  );
}
