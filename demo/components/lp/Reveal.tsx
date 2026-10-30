"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { cx } from "@/components/ui/cx";

type Props = {
  children: ReactNode;
  className?: string;
  // 入れ物のタグ（ul の中の li に使う時は "li"）
  as?: "div" | "li" | "section";
  // 出てくるまでの待ち時間（ミリ秒）。並んだカードを少しずつずらして出す時に使う
  delayMs?: number;
  // as="section" の時の、見出しの id（aria-labelledby）
  labelledBy?: string;
};

// 画面に入った時に、下からふわっと出す入れ物。
// 動きの定義は globals.css の .lp-reveal（JS が動かない時・動きを減らす設定の時は最初から表示）
export function Reveal({ children, className, as: Tag = "div", delayMs = 0, labelledBy }: Props) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      el.dataset.shown = "true";
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        el.dataset.shown = "true";
        observer.disconnect();
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as never}
      aria-labelledby={labelledBy}
      className={cx("lp-reveal", className)}
      style={delayMs > 0 ? { transitionDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
