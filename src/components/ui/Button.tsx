import type { ButtonHTMLAttributes } from "react";
import { cx } from "./cx";

// ghost：枠も背景もない文字だけのボタン（「キャンセル」「ログアウト」など、目立たせたくない操作）
export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const base =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-4 text-body font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-brand-navy text-on-navy hover:bg-brand-navy-hover",
  secondary: "border border-line-strong bg-surface text-brand-navy hover:bg-brand-light",
  danger: "bg-down text-on-navy hover:opacity-90",
  ghost: "text-ink-muted hover:bg-flat-soft/60 hover:text-ink",
};

// リンク（<a>）にも同じ見た目を使うため、クラス名だけを返す関数も出す
export function buttonClass(variant: ButtonVariant = "primary", fullWidth = false): string {
  return cx(base, variants[variant], fullWidth && "w-full");
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  fullWidth?: boolean;
};

// ボタン（主＝ネイビー／副＝白に枠線／危険＝赤）。type を省略した時は "button"（フォームを誤って送信しないため）
export function Button({ variant = "primary", fullWidth, className, type = "button", ...rest }: Props) {
  return <button type={type} className={cx(buttonClass(variant, fullWidth), className)} {...rest} />;
}
