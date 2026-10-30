"use client";

import { FlaskConical, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { AlertMessage } from "@/components/ui/AlertMessage";
import { Button } from "@/components/ui/Button";
import { fetchSampleCsv, SAMPLE_FETCH_ERROR } from "./demo-upload";

type Props = {
  // 取得したダミーCSVを、ファイルを選んだときと同じ流れ（確認 → 取り込み）で読み込む
  onSelect: (files: File[]) => void;
  // アップロード処理中は押せない
  disabled: boolean;
};

// 「ダミーCSVで試す」：同梱のダミーCSVを取得して、自分で選んだCSVと同じ流れに乗せる
export function SampleCsvButton({ onSelect, disabled }: Props) {
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleClick() {
    setFailed(false);
    setLoading(true);
    const file = await fetchSampleCsv();
    setLoading(false);
    if (file === null) {
      setFailed(true);
      return;
    }
    onSelect([file]);
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <Button variant="secondary" onClick={handleClick} disabled={disabled || loading}>
          {loading ? (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <FlaskConical aria-hidden="true" className="size-4" />
          )}
          ダミーCSVで試す
        </Button>
        <p className="text-caption text-ink-muted">用意してあるダミーの売上CSVを、同じ手順で読み込みます。</p>
      </div>
      {failed ? (
        <div className="w-full">
          <AlertMessage>{SAMPLE_FETCH_ERROR}</AlertMessage>
        </div>
      ) : null}
    </div>
  );
}
