// 数字の照合（T-32・architecture.md 第9項）
// AI の文に出てくる金額・割合が、送った集計値（AnalysisPayload）にあるかを確かめる。純粋な関数
// 計算できない値（value が null）は「許される値」に入れない → AI がそこに数字を書けば警告になる

import type { AnalysisPayload } from "./prompt";
import type { AnalysisResult, NumberWarning } from "./schema";

const AMOUNT_TOLERANCE = 0.01; // 「約」・万円表記の金額：±1%
const PERCENT_TOLERANCE = 0.1; // 割合：±0.1（小数第1位に丸めた値どうし）

export type AllowedValues = { amounts: number[]; percents: number[] };

/** 送った集計値から「許される値」の一覧を作る（null は入れない） */
export function buildAllowedValues(payload: AnalysisPayload): AllowedValues {
  const amounts: number[] = [];
  const percents: number[] = [];
  const addPercent = (figure: { value: number | null }) => {
    if (figure.value !== null) percents.push(figure.value);
  };
  for (const m of payload.months) {
    amounts.push(m.revenueYen, m.grossProfitYen);
    addPercent(m.revenueChangePercent);
    addPercent(m.grossProfitChangePercent);
    addPercent(m.repeatRatePercent);
    addPercent(m.repeatChangePoints);
  }
  addPercent(payload.overallRepeatRatePercent);
  for (const c of payload.categories.items) amounts.push(c.revenueYen);
  for (const s of payload.topSkus.items) amounts.push(s.revenueYen);
  return { amounts, percents };
}

/** 全角の数字・記号を半角に直す（NFKC）。マイナス記号の揺れも「-」にそろえる */
function normalize(text: string): string {
  return text.normalize("NFKC").replace(/[−‐‑–—]/g, "-");
}

type Found = {
  kind: "amount" | "percent";
  text: string;
  value: number;
  approximate: boolean;
  sign: "+" | "-" | "";
  /** 割合のすぐ後ろの向きのことば（増・上昇＝up／減・下落＝down）。なければ空 */
  direction?: "up" | "down" | "";
};

// 金額：符号?(マイナス・-・+・▲)・約?・数字（カンマ可・小数可）・万?・円・符号のことば?
//   後ろのことば：「円の赤字」「円の黒字」「円のマイナス」、または円の「すぐ後ろ」の「減」(減少は除く)
//   「減」を金額のすぐ後ろだけにするのは、「前月比12.3%減」のような割合の書き方と混ざらないため
const AMOUNT_RE =
  /(マイナス|[+-]|▲)?\s*(約)?\s*([0-9][0-9,]*(?:\.[0-9]+)?)\s*(万)?\s*円(?:の?(赤字|黒字|マイナス)|(減)(?!少))?/g;
// 割合：符号?・数字・%／ポイント／pt・向きのことば?（すぐ後ろの 増加／増／上昇／減少／減／下落／低下）
//   金額の「減」の規則（円のすぐ後ろ）とは別の正規表現なので混ざらない
const PERCENT_RE = /([+-])?\s*([0-9]+(?:\.[0-9]+)?)\s*(%|ポイント|pt)\s*(?:の)?(増加|増|上昇|減少|減|下落|低下)?/g;
const UP_WORDS = new Set(["増加", "増", "上昇"]);

/** 1つの文から金額と割合を取り出す */
export function extractNumbers(raw: string): Found[] {
  const text = normalize(raw);
  const found: Found[] = [];

  for (const m of text.matchAll(AMOUNT_RE)) {
    const base = Number(m[3].replace(/,/g, ""));
    if (!Number.isFinite(base)) continue;
    const isMan = m[4] !== undefined;
    // 符号：前に書かれた記号が先。なければ後ろのことば（赤字・マイナス・減＝マイナス／黒字＝プラス）
    let sign: Found["sign"] = "";
    if (m[1] !== undefined) sign = m[1] === "+" ? "+" : "-";
    else if (m[5] === "赤字" || m[5] === "マイナス" || m[6] !== undefined) sign = "-";
    else if (m[5] === "黒字") sign = "+";
    found.push({
      kind: "amount",
      text: m[0].trim(),
      value: Math.round(isMan ? base * 10000 : base),
      approximate: m[2] !== undefined || isMan,
      sign,
    });
  }
  for (const m of text.matchAll(PERCENT_RE)) {
    const value = Number(m[2]);
    if (!Number.isFinite(value)) continue;
    found.push({
      kind: "percent",
      text: m[0].trim(),
      value,
      approximate: false,
      sign: m[1] === "+" ? "+" : m[1] === "-" ? "-" : "",
      direction: m[4] === undefined ? "" : UP_WORDS.has(m[4]) ? "up" : "down",
    });
  }
  return found;
}

function amountMatches(found: Found, allowed: readonly number[]): boolean {
  // 大きさは絶対値で比べる（桁違いの検出・「約」の±1%は従来どおり）。
  // 符号：マイナスと書いた金額は許される値もマイナス、プラス（+・黒字）と書いたらプラス。
  // 符号を書いていない金額は、許される値がマイナスなら不一致（赤字を黒字に見せない）
  return allowed.some((raw) => {
    const a = Math.abs(raw);
    const sizeOk = found.approximate ? Math.abs(found.value - a) <= a * AMOUNT_TOLERANCE : found.value === a;
    if (!sizeOk) return false;
    if (found.sign === "-") return raw < 0;
    if (found.sign === "+") return raw > 0;
    return raw >= 0;
  });
}

/**
 * 割合：±0.1 で一致。符号がある時（+12.3%／-5.0%）は符号も合わせる。
 * 符号がなく向きのことば（増・減など）がある時は、向きを符号として読む（12.3%減 ＝ -12.3）。
 * 符号も向きのことばもない時（リピート率 25.0% のような水準）は、絶対値で比べる
 */
function percentMatches(found: Found, allowed: readonly number[]): boolean {
  return allowed.some((a) => {
    const close = (x: number, y: number) => Math.abs(x - y) <= PERCENT_TOLERANCE + 1e-9;
    if (found.sign === "+") return close(found.value, a);
    if (found.sign === "-") return close(-found.value, a);
    // 許される値が 0 の時は向きがないので、大きさだけ比べる（向きの誤警告を増やさない安全側）
    if (found.direction && a !== 0) return close(found.direction === "up" ? found.value : -found.value, a);
    return close(found.value, Math.abs(a));
  });
}

/** AI のコメントの金額・割合を照合し、一致しなかったものの一覧を返す（空なら警告なし） */
export function verifyNumbers(result: AnalysisResult, payload: AnalysisPayload): NumberWarning[] {
  const allowed = buildAllowedValues(payload);
  const fields: [string, string][] = [
    ["summary", result.summary],
    ...result.highlights.map((t, i): [string, string] => [`highlights[${i}]`, t]),
    ...result.concerns.map((t, i): [string, string] => [`concerns[${i}]`, t]),
    ...result.actions.map((a, i): [string, string] => [`actions[${i}]`, a.action]),
  ];

  const warnings: NumberWarning[] = [];
  for (const [field, text] of fields) {
    for (const found of extractNumbers(text)) {
      const ok =
        found.kind === "amount" ? amountMatches(found, allowed.amounts) : percentMatches(found, allowed.percents);
      if (!ok) warnings.push({ kind: found.kind, text: found.text, field });
    }
  }
  return warnings;
}
