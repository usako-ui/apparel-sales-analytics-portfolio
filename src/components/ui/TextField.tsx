import type { LucideIcon } from "lucide-react";
import { useId } from "react";
import type { InputHTMLAttributes } from "react";
import { cx } from "./cx";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  label: string;
  // true なら、ラベルは画面に出さず読み上げだけにする（ログイン画面のように、アイコンと入力例で伝わる時）
  hideLabel?: boolean;
  icon?: LucideIcon;
  // 入力のヒント（「8文字以上」など）。入力欄の下に小さく出す
  hint?: string;
  // 入力の誤りを伝える文。あれば赤い枠と文で示す
  error?: string;
};

// 入力欄（アイコン付き・ヒント・エラー表示つき）。ラベルは必ず付ける（読み上げ・クリックで入力欄へ移るため）
export function TextField({ label, hideLabel, icon: Icon, hint, error, className, ...rest }: Props) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={cx("text-body font-semibold text-ink", hideLabel && "sr-only")}>
        {label}
      </label>
      <div className="relative">
        {Icon ? (
          <Icon
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-ink-muted"
          />
        ) : null}
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cx(
            "min-h-11 w-full rounded-control border bg-surface py-2 pr-3 text-body text-ink placeholder:text-ink-muted",
            Icon ? "pl-10" : "pl-3",
            error ? "border-down" : "border-line-strong",
            className,
          )}
          {...rest}
        />
      </div>
      {hint ? (
        <p id={hintId} className="text-caption text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-caption text-down">
          {error}
        </p>
      ) : null}
    </div>
  );
}
