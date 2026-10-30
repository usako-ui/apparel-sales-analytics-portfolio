import type { ReactNode } from "react";

type Props = {
  title: string;
  description?: string;
  // 右側に置く操作（「メンバー追加」など）
  action?: ReactNode;
};

// 画面の見出し（タイトル・説明・右側の操作）。Day5 以降の画面も同じものを使う
export function PageHeader({ title, description, action }: Props) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-title font-bold text-brand-navy">{title}</h1>
        {description ? <p className="mt-1 text-body text-ink-muted">{description}</p> : null}
      </div>
      {action}
    </header>
  );
}
