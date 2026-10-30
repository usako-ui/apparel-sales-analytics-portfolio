import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "@/components/ui/cx";
import { DEMO_URL, GITHUB_URL } from "../../lib/contact";

type DemoButtonProps = {
  // "sm"：ヘッダー／"lg"：ファーストビュー／"xl"：最後の呼びかけ
  size: "sm" | "lg" | "xl";
  // true：「（ログイン不要）」を添える
  withHint?: boolean;
  // "onLight"：ネイビーのボタン（薄い背景の上）／"onDark"：白地にネイビーの文字（濃いネイビーの上）
  tone?: "onLight" | "onDark";
  className?: string;
};

const demoToneClass = {
  onLight: "bg-brand-navy text-on-navy shadow-card hover:bg-brand-navy-hover",
  onDark: "bg-surface text-brand-navy shadow-lp-float hover:bg-lp-tint-deep focus-visible:outline-on-navy",
} as const;

const demoSizeClass = {
  sm: "min-h-11 rounded-lg px-5 text-[14px]",
  lg: "min-h-14 rounded-xl px-7 text-[16px] md:px-8",
  xl: "min-h-14 rounded-full px-9 text-[17px] md:min-h-[3.75rem] md:px-12",
} as const;

// 「デモを試す」ボタン（デモ版 /demo へ）。高さは 44px 以上
export function DemoLinkButton({ size, withHint = false, tone = "onLight", className }: DemoButtonProps) {
  return (
    <Link
      href={DEMO_URL}
      className={cx("inline-flex items-center justify-center gap-2 font-bold transition-colors", demoToneClass[tone], demoSizeClass[size], className)}
    >
      <span>デモを試す</span>
      {withHint ? <span className={cx("text-[0.8em] font-normal", tone === "onDark" ? "text-ink-muted" : "text-on-navy-muted")}>（ログイン不要）</span> : null}
      {withHint ? <ChevronRight aria-hidden="true" className="size-4 shrink-0" /> : null}
    </Link>
  );
}

type ExternalProps = {
  href: string;
  children: ReactNode;
  className?: string;
};

// 外部サイトへのリンク（新しいタブで開く。referrer を渡さない）
export function ExternalLink({ href, children, className }: ExternalProps) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}

type GithubLinkProps = {
  children: ReactNode;
  className?: string;
};

// 「GitHub」へのリンク。公開リポジトリの URL（contact.ts の GITHUB_URL）が null のあいだは、押せない表示にする
export function GithubLink({ children, className }: GithubLinkProps) {
  if (GITHUB_URL === null) {
    return (
      <span role="link" aria-disabled="true" className={cx(className, "cursor-not-allowed opacity-50")}>
        {children}
      </span>
    );
  }
  return (
    <ExternalLink href={GITHUB_URL} className={className}>
      {children}
    </ExternalLink>
  );
}
