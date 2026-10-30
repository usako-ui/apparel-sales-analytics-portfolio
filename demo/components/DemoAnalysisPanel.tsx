"use client";

import { ExternalLink, Info, KeyRound, Trash2 } from "lucide-react";
import { useState } from "react";
import { AnalysisPanelView, type ShownReport } from "@/components/analysis/AnalysisPanelView";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { formatMonthLabel } from "@/components/upload/month-label";
import { buildAnalysisInput } from "@/lib/analysis/input";
import { FAILURE_MESSAGE, generateAnalysis } from "@/lib/analysis/run";
import type { SalesRow } from "@/lib/csv/validate";
import { failureMessageOf } from "../lib/analysis-errors";
import { createBrowserGenerate } from "../lib/gemini-browser";
import type { KeyHolder } from "../lib/key-holder";
import { DemoNotice } from "./DemoNotice";

export const API_KEY_URL = "https://aistudio.google.com/apikey";

// 常時表示の注意書き（architecture.md 第19項の文面そのまま）
export const KEY_NOTICE =
  "AI 分析には、あなたの Gemini API キーを使います。キーはこの画面を開いている間だけ保持し、保存しません（画面を閉じる・再読み込みすると消えます）。入力した内容は Google にだけ送られます。無料枠のキーでは、送った内容が Google のサービス改善に使われ、人が読むこともあります（公式 ai.google.dev/gemini-api/terms を 2026-10-29 に確認）。ダミーのデータだけで試してください。デモ用に別のキーを作り、試したあとは Google AI Studio で削除することをおすすめします。";

export const KEY_REQUIRED_REASON =
  "Gemini API キーを入力すると、「分析を生成」を押せるようになります。キーの作り方は、入力欄の下の案内を見てください。";

type Props = {
  /** 対象の月（YYYY-MM）。月を変えたら、呼び出し側が key で作り直す */
  month: string;
  /** 保存済みの行（ブラウザ内）。LLM へは、ここから作る集計値だけを送る */
  rows: SalesRow[];
  /** キーの保持（メモリだけ）。月を切り替えても残すため、呼び出し側が持つ */
  keyHolder: KeyHolder;
  /** その月の生成済みの分析（メモリ）。なければ null */
  latest: ShownReport | null;
  /** 生成に成功した時に、呼び出し側のメモリへ保存する */
  onReport: (month: string, shown: ShownReport) => void;
  /** 入力途中のキー（メモリの state）。月を切り替えても消えないよう、呼び出し側が持つ */
  keyInput: string;
  onKeyInputChange: (value: string) => void;
  /** いま生成中の月（なければ null）。ページ全体で1つだけ。月を切り替えても引き継ぐため、呼び出し側が持つ */
  generatingMonth: string | null;
  /** 生成の開始を申請する。すでに生成中なら false（開始しない） */
  onGenerateStart: (month: string) => boolean;
  onGenerateEnd: () => void;
  /** その月の生成結果の案内（失敗の文・成功の案内）。月を切り替えても残すため、呼び出し側が月ごとに持つ */
  notice: AnalysisNotice;
  onNoticeChange: (month: string, notice: AnalysisNotice) => void;
};

/** 月ごとの案内の状態。失敗の文は日本語の固定文だけ（キー・Google の返答の原文は入れない） */
export type AnalysisNotice = { errorMessage: string | null; justGenerated: boolean };
export const EMPTY_NOTICE: AnalysisNotice = { errorMessage: null, justGenerated: false };

export const OTHER_MONTH_GENERATING_REASON =
  "別の月の分析を生成しています。終わるまで、この月の「分析を生成」は押せません。";

// デモ版の「AI分析コメント」の区画。閲覧者自身の Gemini キーで、ブラウザから直接生成する
export function DemoAnalysisPanel({
  month,
  rows,
  keyHolder,
  latest,
  onReport,
  keyInput,
  onKeyInputChange,
  generatingMonth,
  onGenerateStart,
  onGenerateEnd,
  notice,
  onNoticeChange,
}: Props) {
  // 保持しているキーがあるか（キー本体は state に持たない）
  const [keyHeld, setKeyHeld] = useState(() => keyHolder.has());
  const { errorMessage, justGenerated } = notice;

  const pending = generatingMonth === month;
  const otherMonthGenerating = generatingMonth !== null && generatingMonth !== month;
  const canGenerate = keyInput.trim() !== "" || keyHeld;

  async function handleGenerate() {
    if (generatingMonth !== null) return;
    if (keyInput.trim() !== "") {
      keyHolder.set(keyInput);
      setKeyHeld(true);
      onKeyInputChange(""); // 入力欄にキーを残さない
    }
    const key = keyHolder.get();
    if (key === null) return;

    // ページ全体で1件だけ。同時の連続クリックもここで止まる
    if (!onGenerateStart(month)) return;
    onNoticeChange(month, EMPTY_NOTICE);
    try {
      const input = buildAnalysisInput(rows, month);
      const result = await generateAnalysis(input, createBrowserGenerate(key));
      if (result.ok) {
        onReport(month, { report: result.report, generatedAt: new Date().toISOString() });
        onNoticeChange(month, { errorMessage: null, justGenerated: true });
      } else {
        onNoticeChange(month, { errorMessage: failureMessageOf(result), justGenerated: false });
      }
    } catch {
      // 元のエラーは表示も記録もしない（キーや通信の中身を含みうるため）
      onNoticeChange(month, { errorMessage: FAILURE_MESSAGE, justGenerated: false });
    } finally {
      onGenerateEnd();
    }
  }

  function handleClearKey() {
    keyHolder.clear();
    setKeyHeld(false);
    onKeyInputChange("");
    onNoticeChange(month, EMPTY_NOTICE);
  }

  const extra = (
    <div className="flex flex-col gap-4">
      <DemoNotice tone="info">
        <p>{KEY_NOTICE}</p>
      </DemoNotice>

      <div className="flex flex-col gap-3">
        {/* <form> は使わない（パスワードの保存の提案を出さないため）。ボタンの onClick で動かす */}
        <TextField
          label="Gemini API キー"
          icon={KeyRound}
          type="password"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          value={keyInput}
          onChange={(event) => onKeyInputChange(event.target.value)}
          placeholder={keyHeld ? "入力済み（再入力すると置き換えます）" : "Gemini API キーを貼り付け"}
          hint={keyHeld ? "キーはこの画面を開いている間だけ保持しています。" : undefined}
        />
        <div>
          <Button variant="secondary" onClick={handleClearKey} disabled={!canGenerate || generatingMonth !== null}>
            <Trash2 aria-hidden="true" className="size-4" />
            キーを消す
          </Button>
        </div>
      </div>

      <p className="flex items-start gap-2 text-caption text-ink-muted">
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <span>
          キーは Google AI Studio（
          <a
            href={API_KEY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-brand-navy underline underline-offset-2"
          >
            {API_KEY_URL}
            <ExternalLink aria-hidden="true" className="size-3.5" />
            <span className="sr-only">（新しいタブで開きます）</span>
          </a>
          ）で「Create API key」を押して作ります。
        </span>
      </p>
    </div>
  );

  return (
    <AnalysisPanelView
      monthLabel={formatMonthLabel(month)}
      latest={latest}
      pending={pending}
      errorMessage={errorMessage}
      signedOut={false}
      justGenerated={justGenerated}
      onGenerate={handleGenerate}
      extra={extra}
      generateBlockedReason={
        otherMonthGenerating ? OTHER_MONTH_GENERATING_REASON : canGenerate ? null : KEY_REQUIRED_REASON
      }
    />
  );
}
