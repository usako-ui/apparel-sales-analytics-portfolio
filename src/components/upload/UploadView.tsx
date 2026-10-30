"use client";

import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { AlertMessage } from "@/components/ui/AlertMessage";
import { Button, buttonClass } from "@/components/ui/Button";
import { SuccessMessage } from "@/components/ui/SuccessMessage";
import type { SkippedRow } from "@/lib/csv/validate";
import type { ImportResult, PreviewResult } from "@/lib/upload/import";
import { checkSelectedFile, TOO_MANY_FILES_MESSAGE } from "./check-file";
import { downloadSkippedRows } from "./download-skipped";
import { DropZone } from "./DropZone";
import { formatMonthList } from "./month-label";
import { OverwriteDialog } from "./OverwriteDialog";
import { ResultCard } from "./ResultCard";

type PreviewOk = Extract<PreviewResult, { ok: true }>;
type ImportOk = Extract<ImportResult, { ok: true }>;

// 画面の状態。選び直すと、いつも idle から始める
type Stage =
  | { kind: "idle" }
  | { kind: "previewed"; file: File; preview: PreviewOk }
  | { kind: "imported"; result: ImportOk };

// 取り込めなかった・確認できなかった時の表示。skipped があれば（全行スキップなど）ダウンロードも出す
type Problem = { message: string; fileName?: string; skipped?: SkippedRow[]; signedOut?: boolean };

const NETWORK_ERROR = "通信に失敗しました。接続を確かめてから、もう一度お試しください。";
// 確認・取り込みの途中でログインが切れた時（Cookie の期限切れなど）。ログイン画面へのリンクを添える
const SIGNED_OUT_ERROR = "ログインの有効期限が切れました。もう一度ログインしてください。";

/** DropZone の下に、追加の操作（デモ版の「ダミーCSVで試す」など）を置くための道具 */
export type UploadExtraContext = {
  /** 選んだファイルと同じ流れ（確認 → 取り込み）で読み込む */
  select: (files: File[]) => void;
  /** 処理中は true（操作を止める） */
  disabled: boolean;
};

export type UploadViewProps = {
  /** 確認（DBには書かない）。本番は Server Action、デモはブラウザ内の処理 */
  onPreview: (formData: FormData) => Promise<PreviewResult>;
  /** 取り込み。overwrite が "true" のときだけ上書きを許可する */
  onImport: (formData: FormData) => Promise<ImportResult>;
  /** 取り込み後の「ダッシュボードを見る」のリンク先 */
  dashboardHref?: string;
  /** 失敗の原因がログイン切れかを確かめる。省略時は、ログイン切れの案内を出さない（通信の失敗として扱う） */
  checkSignedOut?: () => Promise<boolean>;
  /** DropZone の下に置く追加の操作 */
  renderExtra?: (context: UploadExtraContext) => ReactNode;
};

// CSVアップロード画面の本体。サーバー処理は props で受ける（本番＝UploadManager、デモ＝demo/components）
export function UploadView({ onPreview, onImport, dashboardHref = "/", checkSignedOut, renderExtra }: UploadViewProps) {
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [problem, setProblem] = useState<Problem | null>(null);
  const [overwriteMonths, setOverwriteMonths] = useState<string[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, startTransition] = useTransition();
  // busy は次の描画まで変わらないため、同じ描画の中の連続クリックは ref で止める（二重送信の防止）
  const runningRef = useRef(false);

  // サーバーの処理を1つずつ実行する。処理中は何もしない
  function run(task: () => Promise<void>) {
    if (runningRef.current) return;
    runningRef.current = true;
    startTransition(async () => {
      try {
        await task();
      } catch {
        // 失敗の原因が、通信ではなくログイン切れなら、ログインし直す案内にする
        const signedOut = checkSignedOut ? await checkSignedOut() : false;
        setOverwriteMonths(null);
        setProblem(signedOut ? { message: SIGNED_OUT_ERROR, signedOut: true } : { message: NETWORK_ERROR });
      } finally {
        runningRef.current = false;
        setChecking(false);
      }
    });
  }

  function handleSelect(files: File[]) {
    setProblem(null);
    setOverwriteMonths(null);
    setStage({ kind: "idle" });

    if (files.length > 1) {
      setProblem({ message: TOO_MANY_FILES_MESSAGE });
      return;
    }
    const file = files[0];
    // 5MB・形式の確認。ここで止めたファイルはサーバーへ送らない
    const message = checkSelectedFile(file);
    if (message) {
      setProblem({ message, fileName: file.name });
      return;
    }

    setChecking(true);
    run(async () => {
      const formData = new FormData();
      formData.set("file", file);
      const result = await onPreview(formData);
      if (result.ok) {
        setStage({ kind: "previewed", file, preview: result });
      } else {
        setProblem({ message: result.message, fileName: file.name, skipped: result.skipped });
      }
    });
  }

  function handleImport(overwrite: boolean) {
    if (stage.kind !== "previewed") return;
    const { file, preview } = stage;
    setProblem(null);
    run(async () => {
      const formData = new FormData();
      formData.set("file", file);
      if (overwrite) formData.set("overwrite", "true");
      const result = await onImport(formData);

      if (result.ok) {
        setOverwriteMonths(null);
        setStage({ kind: "imported", result });
      } else if (result.code === "needsOverwrite") {
        // 上書きになる月がある：確認ダイアログへ（「上書きする」を押した時だけ、overwrite 付きで呼び直す）
        setOverwriteMonths(result.overwriteMonths?.length ? result.overwriteMonths : preview.overwriteMonths);
      } else {
        setOverwriteMonths(null);
        setProblem({ message: result.message, fileName: preview.fileName, skipped: result.skipped });
      }
    });
  }

  const disabled = checking || busy;

  return (
    <div className="flex flex-col gap-5">
      <DropZone disabled={disabled} onSelect={handleSelect} />

      {renderExtra ? <ExtraSlot render={renderExtra} select={handleSelect} disabled={disabled} /> : null}

      {checking ? (
        <p role="status" className="flex items-center gap-2 text-body text-ink-muted">
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ファイルを確認しています…
        </p>
      ) : null}

      {problem ? (
        <div className="flex flex-col items-start gap-3">
          <div className="w-full">
            <AlertMessage>{problem.message}</AlertMessage>
          </div>
          {problem.signedOut ? (
            <Link href="/login" className={buttonClass("primary")}>
              ログイン画面へ
            </Link>
          ) : null}
          {problem.skipped && problem.skipped.length > 0 ? (
            <Button variant="secondary" onClick={() => downloadSkippedRows(problem.skipped ?? [], problem.fileName ?? "")}>
              スキップ行をダウンロード
            </Button>
          ) : null}
        </div>
      ) : null}

      {stage.kind === "previewed" ? (
        <ResultCard
          mode="preview"
          fileName={stage.preview.fileName}
          successCount={stage.preview.successCount}
          skippedCount={stage.preview.skipped.length}
          months={stage.preview.months}
          overwriteMonths={stage.preview.overwriteMonths}
          onDownloadSkipped={() => downloadSkippedRows(stage.preview.skipped, stage.preview.fileName)}
        >
          <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-caption text-ink-muted">「取り込む」を押すまで、データは保存されません。</p>
            <Button onClick={() => handleImport(false)} disabled={disabled}>
              {busy ? "取り込み中…" : "取り込む"}
            </Button>
          </div>
        </ResultCard>
      ) : null}

      {stage.kind === "imported" ? (
        <ResultCard
          mode="imported"
          fileName={stage.result.fileName}
          successCount={stage.result.successCount}
          skippedCount={stage.result.skipped.length}
          months={stage.result.months}
          overwriteMonths={[]}
          onDownloadSkipped={() => downloadSkippedRows(stage.result.skipped, stage.result.fileName)}
        >
          <div className="flex flex-col gap-3 border-t border-line pt-4">
            <SuccessMessage>{importedMessage(stage.result)}</SuccessMessage>
            <div>
              <Link href={dashboardHref} className={buttonClass("primary")}>
                ダッシュボードを見る
              </Link>
            </div>
          </div>
        </ResultCard>
      ) : null}

      <OverwriteDialog
        open={overwriteMonths !== null}
        months={overwriteMonths ?? []}
        busy={busy}
        onOverwrite={() => handleImport(true)}
        onCancel={() => setOverwriteMonths(null)}
      />
    </div>
  );
}

// 追加の操作の置き場。render を部品の中で呼ぶ（UploadView の描画の中で ref を渡さないため）
function ExtraSlot({ render, select, disabled }: UploadExtraContext & { render: NonNullable<UploadViewProps["renderExtra"]> }) {
  return <>{render({ select, disabled })}</>;
}

function importedMessage(result: ImportOk): string {
  const base = `${result.successCount}行を取り込みました。`;
  return result.overwriteMonths.length > 0 ? `${base}${formatMonthList(result.overwriteMonths)}のデータを上書きしました。` : base;
}
