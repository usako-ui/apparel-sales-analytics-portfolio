"use client";

import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { formatMonthList } from "./month-label";

type Props = {
  open: boolean;
  // 上書きになる月（YYYY-MM）
  months: string[];
  busy: boolean;
  onOverwrite: () => void;
  // 「上書きしない」：閉じるだけで、何も取り込まない
  onCancel: () => void;
};

// 上書きの確認（すでにある月があるとき）
export function OverwriteDialog({ open, months, busy, onOverwrite, onCancel }: Props) {
  return (
    <Dialog open={open} onClose={onCancel} title="上書きの確認" icon={<TriangleAlert aria-hidden="true" className="size-5" />}>
      <div className="flex flex-col gap-2 text-body">
        <p>
          <strong data-testid="overwrite-months">{formatMonthList(months)}</strong>
          のデータはすでにあります。上書きしますか？
        </p>
        <p className="text-caption text-ink-muted">
          上書きすると、その月の古いデータは新しいものに置き換わります。「上書きしない」を選ぶと、このCSVは何も取り込みません。
        </p>
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          上書きしない
        </Button>
        <Button onClick={onOverwrite} disabled={busy}>
          {busy ? "取り込み中…" : "上書きする"}
        </Button>
      </div>
    </Dialog>
  );
}
