"use client";

import { useRef, useState, useTransition } from "react";
import { generateAnalysisAction } from "@/actions/analysis";
import { formatMonthLabel } from "@/components/upload/month-label";
import { requestAnalysis } from "./analysis-request";
import { AnalysisPanelView, type ShownReport } from "./AnalysisPanelView";

type Props = {
  /** 対象の月（ダッシュボードで選んでいる月・YYYY-MM）。月を変えたら、呼び出し側が key で作り直す */
  month: string;
  /** その月の最新の分析（サーバーで読んだもの）。なければ null */
  latest: ShownReport | null;
};

// 「AI分析コメント」の区画。「分析を生成」を押すと Server Action を呼び、成功するとページが読み直されて最新の分析が出る
export function AnalysisPanel({ month, latest }: Props) {
  const [pending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [justGenerated, setJustGenerated] = useState(false);
  // pending は次の描画まで変わらないため、同じ描画の中の連続クリックは ref で止める（二重押しで API を無駄に呼ばない）
  const runningRef = useRef(false);

  function handleGenerate() {
    if (runningRef.current) return;
    runningRef.current = true;
    setErrorMessage(null);
    setSignedOut(false);
    setJustGenerated(false);
    startTransition(async () => {
      try {
        const outcome = await requestAnalysis(month, generateAnalysisAction);
        if (outcome.ok) {
          setJustGenerated(true);
        } else {
          setErrorMessage(outcome.message);
          setSignedOut(outcome.signedOut);
        }
      } finally {
        runningRef.current = false;
      }
    });
  }

  return (
    <AnalysisPanelView
      monthLabel={formatMonthLabel(month)}
      latest={latest}
      pending={pending}
      errorMessage={errorMessage}
      signedOut={signedOut}
      justGenerated={justGenerated}
      onGenerate={handleGenerate}
    />
  );
}
