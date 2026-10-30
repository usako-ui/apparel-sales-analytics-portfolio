// AI分析コメントの表示に使う、小さな関数と文言（T-34・35）。画面の部品から使う
import type { StoredReport } from "@/lib/analysis/schema";

export type Priority = StoredReport["actions"][number]["priority"];

// 優先度の表示。色だけに頼らず、必ず文字（高・中・低）を添える。色はブランドの値だけ
export const PRIORITY_VIEW: Record<Priority, { label: string; className: string }> = {
  high: { label: "優先度 高", className: "bg-brand-navy text-on-navy" },
  medium: { label: "優先度 中", className: "bg-chart-5 text-brand-navy" },
  low: { label: "優先度 低", className: "bg-flat-soft text-flat" },
};

/** 生成した日時の表示（日本時間・"2026年10月27日 14:05"）。読めない値は null */
export function formatGeneratedAt(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}年${get("month")}月${get("day")}日 ${get("hour")}:${get("minute")}`;
}

/**
 * 数字の照合の警告が指す場所を、日本語にする（summary → まとめ、highlights[0] → 注目点1 など）。
 * 知らない形は null（場所は出さず、数値だけを出す）
 */
export function describeWarningField(field: string): string | null {
  if (field === "summary") return "まとめ";
  const match = /^(highlights|concerns|actions)\[(\d+)\]/.exec(field);
  if (!match) return null;
  const names = { highlights: "注目点", concerns: "気になる点", actions: "打ち手" } as const;
  return `${names[match[1] as keyof typeof names]}${Number(match[2]) + 1}`;
}
