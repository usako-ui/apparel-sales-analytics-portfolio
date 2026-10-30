// 割合は「分子・分母」で持ち、丸めは表示の直前の1か所（roundPercent）だけで行う
// 浮動小数の誤差を避けるため、丸めの計算は BigInt（整数）で行う

/** 分数。割合の値は numerator ÷ denominator × 100（%）。denominator は常に 1 以上 */
export type Ratio = { numerator: number; denominator: number };

/** 分子・分母から Ratio を作る。分母が 0 以下なら null（「—」表示） */
export function makeRatio(numerator: number, denominator: number): Ratio | null {
  return denominator > 0 ? { numerator, denominator } : null;
}

/** 「—」にする理由のコード（画面・AI は explainReason で日本語にする） */
export type ChangeReason =
  | "noPreviousMonth" // 前月のデータがない
  | "previousZero" // 前月の値が0
  | "previousNegative" // 前月の値がマイナス
  | "noPreviousBuyers" // 前月の購入者が0人（リピート率の前月差）
  | "noBuyers" // 当月の購入者が0人（リピート率の前月差）
  | "noCustomerId"; // 顧客IDのある購入者がいない（リピート率そのもの）

/** 前月比・前月差・リピート率の結果。計算できない時は ratio が null で、理由を持つ */
export type Change = { ratio: Ratio; reason: null } | { ratio: null; reason: ChangeReason };

/** 計算できない結果を作る */
export function unavailable(reason: ChangeReason): Change {
  return { ratio: null, reason };
}

/**
 * 前月比 = (当月 − 前月) ÷ 前月 × 100。売上・粗利すべてこの1つで判定する。
 * 前月のデータなし／前月が0／前月がマイナスなら計算しない
 */
export function makeChange(current: number, previous: number | undefined): Change {
  if (previous === undefined) return unavailable("noPreviousMonth");
  if (previous === 0) return unavailable("previousZero");
  if (previous < 0) return unavailable("previousNegative");
  return { ratio: { numerator: current - previous, denominator: previous }, reason: null };
}

const REASON_TEXT: Record<ChangeReason, string> = {
  noPreviousMonth: "前月のデータがありません",
  previousZero: "前月が0のため計算できません",
  previousNegative: "前月がマイナスのため計算できません",
  noPreviousBuyers: "前月の購入者がいないため計算できません",
  noBuyers: "この月の購入者がいないため計算できません",
  noCustomerId: "顧客IDのある購入者がいないため計算できません",
};

/** 理由 → 日本語の短い説明（画面の補足・AI の送信内容で共通。純粋な関数） */
export function explainReason(reason: ChangeReason): string {
  return REASON_TEXT[reason];
}

/**
 * Ratio を % の値にして、小数第1位へ四捨五入（0.05 は切り上げ・負の値は絶対値で四捨五入）。
 * null のときは null。表示側（画面・AI の送信内容）はこの関数だけを使う
 */
export function roundPercent(ratio: Ratio | null): number | null {
  if (ratio === null) return null;
  // 小数・NaN・無限大・分母0以下は BigInt が RangeError になるため、計算せず null
  if (!Number.isInteger(ratio.numerator) || !Number.isInteger(ratio.denominator) || ratio.denominator <= 0) {
    return null;
  }
  const n = BigInt(ratio.numerator);
  const d = BigInt(ratio.denominator);
  const negative = n < BigInt(0);
  const abs = negative ? -n : n;
  // abs/d*100 を 0.1 刻みにする = abs*1000/d を四捨五入
  const tenths = (abs * BigInt(2000) + d) / (BigInt(2) * d);
  const value = Number(tenths) / 10;
  if (value === 0) return 0;
  return negative ? -value : value;
}
