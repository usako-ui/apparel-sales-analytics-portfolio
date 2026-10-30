// 数字の表示用の整形（画面で使う）。計算はしない：割合の丸めは集計側の roundPercent を使う
// 金額は円の整数を3桁区切りにするだけ。割合は小数第1位まで

import { explainReason, roundPercent, type Change, type Ratio } from "@/lib/aggregate";

const yenFormat = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 });

/** 円の整数を3桁区切りに（単位は付けない）。例：264700 → "264,700" */
export function formatYen(amount: number): string {
  return yenFormat.format(amount);
}

/**
 * グラフの軸・ラベル用に「万円」で短くする（小数第1位まで・四捨五入・末尾の .0 は省く）。
 * 例：147500 → "14.8万"、50000 → "5万"、0 → "0万"、-12000 → "-1.2万"。金額そのもの（ツールチップ）は formatYen を使う
 */
export function formatManYen(amount: number): string {
  const tenths = Math.round(Math.abs(amount) / 1000); // 0.1万 = 1,000円
  const text = (tenths / 10).toFixed(1).replace(/\.0$/, "");
  return `${amount < 0 && tenths > 0 ? "-" : ""}${text}万`;
}

/** 割合を小数第1位までの文字に（単位・符号なし）。計算できない（null）なら null。例：46.7 → "46.7" */
export function formatPercent(ratio: Ratio | null): string | null {
  const value = roundPercent(ratio);
  return value === null ? null : value.toFixed(1);
}

export type ChangeTone = "up" | "down" | "flat";

/** 前月比・前月差の表示用の形。text が null なら「—」で、reason に短い説明（日本語） */
export type ChangeView = { text: string | null; tone: ChangeTone | null; reason: string | null };

/**
 * 集計の Change（前月比・前月差）を画面用にする。色は表示する値（小数第1位に丸めた後）の符号で決める：
 * 増加＝up・減少＝down・0.0＝flat。計算できない時は「—」と、explainReason の説明
 */
export function viewChange(change: Change, unit: "%" | "pt"): ChangeView {
  const value = roundPercent(change.ratio);
  if (value === null) {
    return { text: null, tone: null, reason: change.reason === null ? null : explainReason(change.reason) };
  }
  const tone: ChangeTone = value > 0 ? "up" : value < 0 ? "down" : "flat";
  return { text: `${formatSignedPercent(change.ratio)}${unit}`, tone, reason: null };
}

/** 符号つき。例：79.5 → "+79.5"、-3.2 → "-3.2"、0 → "0.0"。計算できないなら null */
export function formatSignedPercent(ratio: Ratio | null): string | null {
  const value = roundPercent(ratio);
  if (value === null) return null;
  const text = value.toFixed(1);
  return value > 0 ? `+${text}` : text;
}
