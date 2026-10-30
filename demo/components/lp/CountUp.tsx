"use client";

import { useEffect, useRef } from "react";

type Props = {
  // 最終の値（画面には最初からこの値が出ている。JS が動かない時・動きを減らす設定の時はそのまま）
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  durationMs?: number;
};

function formatValue(n: number, decimals: number, prefix: string, suffix: string): string {
  return `${prefix}${n.toFixed(decimals)}${suffix}`;
}

// 数字が画面に入った時に、0 から最終の値まで数え上がる（動きを減らす設定の時は動かさない）
export function CountUp({ value, decimals = 0, prefix = "", suffix = "", durationMs = 1400 }: Props) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    el.textContent = formatValue(0, decimals, prefix, suffix);
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      observer.disconnect();
      const startedAt = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - startedAt) / durationMs);
        const eased = 1 - Math.pow(1 - t, 3); // 終わりに向けてゆっくりになる
        el.textContent = formatValue(value * eased, decimals, prefix, suffix);
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    });
    observer.observe(el);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      el.textContent = formatValue(value, decimals, prefix, suffix); // 途中で止まっても、最終の値に戻す
    };
  }, [value, decimals, prefix, suffix, durationMs]);

  return <span ref={ref}>{formatValue(value, decimals, prefix, suffix)}</span>;
}
