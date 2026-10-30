"use client";

import { CloudUpload } from "lucide-react";
import { useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";

type Props = {
  // 処理中は選べない
  disabled: boolean;
  // 選ばれたファイル（ドロップ・「ファイルを選ぶ」のどちらでも、ここに渡る）
  onSelect: (files: File[]) => void;
};

// ドラッグ＆ドロップの領域（点線の枠）＋「ファイルを選ぶ」ボタン
// キーボードの人もボタンから選べる。ファイル選択の入力は画面に出さず、ボタンから開く
export function DropZone({ disabled, onSelect }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleDrag(event: DragEvent<HTMLDivElement>, active: boolean) {
    event.preventDefault();
    if (!disabled) setDragging(active);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) onSelect(files);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    // 同じファイルをもう一度選べるように、選んだ後は空に戻す
    event.target.value = "";
    if (files.length > 0) onSelect(files);
  }

  return (
    <div
      onDragEnter={(event) => handleDrag(event, true)}
      onDragOver={(event) => handleDrag(event, true)}
      onDragLeave={(event) => handleDrag(event, false)}
      onDrop={handleDrop}
      className={cx(
        "flex flex-col items-center gap-3 rounded-card border-2 border-dashed px-4 py-8 text-center transition-colors md:py-12",
        dragging ? "border-brand-navy bg-chart-5/40" : "border-chart-3 bg-surface",
      )}
    >
      <CloudUpload aria-hidden="true" className="size-12 text-brand-navy" strokeWidth={1.5} />
      <p className="text-heading font-bold text-brand-navy">
        <span className="hidden md:inline">ここにCSVファイルをドラッグ＆ドロップ</span>
        <span className="md:hidden">CSVファイルを選んでください</span>
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        aria-label="CSVファイルを選ぶ"
        data-testid="csv-file-input"
        onChange={handleChange}
        disabled={disabled}
      />
      <div className="flex items-center gap-3">
        <span className="hidden text-body text-ink-muted md:inline">または</span>
        <Button variant="secondary" onClick={() => inputRef.current?.click()} disabled={disabled}>
          ファイルを選ぶ
        </Button>
      </div>
      <p className="text-caption text-ink-muted">対応ファイル：CSV（.csv）・5MBまで</p>
    </div>
  );
}
