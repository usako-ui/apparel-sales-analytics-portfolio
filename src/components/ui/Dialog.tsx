"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  // タイトルの左に出す線アイコン（任意）
  icon?: ReactNode;
  children: ReactNode;
};

// ダイアログ（確認・一時パスワードの表示などに使う）
// 標準の <dialog> を使うので、Esc で閉じる・背景を操作できない・フォーカスが外に出ない、が自動で効く
export function Dialog({ open, onClose, title, icon, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      // Esc・閉じるボタンのどちらでも、親の状態に反映する
      onClose={onClose}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-card bg-surface p-0 text-ink shadow-dialog backdrop:bg-brand-navy/40"
    >
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-start gap-2">
          {icon ? <span className="mt-0.5 text-brand-navy">{icon}</span> : null}
          <h2 id={titleId} className="flex-1 text-heading font-bold text-brand-navy">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="ダイアログを閉じる"
            className="-m-2 inline-flex size-11 items-center justify-center rounded-control text-ink-muted hover:text-ink"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
