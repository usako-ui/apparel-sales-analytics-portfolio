// 行ごとの検証（Zod）・スキップ行・スキップ行CSV・月ごとの分割
// ブラウザでも動くよう、node 専用の機能は使わない

import Papa from "papaparse";
import { z } from "zod";
import { CANONICAL_COLUMNS, type CanonicalColumn } from "./columns";
import { normalizeDate } from "./normalize";

/** 検証に通った1行（金額は整数の円） */
export type SalesRow = {
  orderDate: string; // YYYY-MM-DD
  customerId: string | null;
  productName: string;
  category: string;
  sku: string;
  quantity: number;
  revenue: number;
  cost: number;
};

/** スキップした行。values は正式な列名ごとの元の値（別名にない列は含まない） */
export type SkippedRow = {
  rowNumber: number; // 元ファイルの行番号（見出しが1行目）
  values: Record<CanonicalColumn, string>;
  reason: string; // 日本語。複数あれば「／」でつなぐ
};

export type MonthGroup = { month: string; rows: SalesRow[] };

// DB の integer の上限。これを超える値は保存できないのでスキップ
const INT_MAX = 2_147_483_647;

type NumberResult = { ok: true; value: number } | { ok: false; message: string };

/** 整数に等しい数値だけ受け付ける（7600 と 7600.0 は可、7600.5 は不可） */
function parseWholeNumber(raw: string, label: string, min: number): NumberResult {
  if (!/^-?\d+(\.\d+)?$/.test(raw)) {
    return { ok: false, message: `${label}が数値ではありません` };
  }
  const [intPart, fracPart = ""] = raw.split(".");
  if (!/^0*$/.test(fracPart)) {
    return { ok: false, message: `${label}が整数ではありません` };
  }
  const value = Number(intPart);
  if (value < min) {
    return { ok: false, message: min === 1 ? `${label}は1以上にしてください` : `${label}は0以上にしてください` };
  }
  if (value > INT_MAX) {
    return { ok: false, message: `${label}が大きすぎます` };
  }
  return { ok: true, value };
}

function wholeNumber(label: string, min: number) {
  return z.string().transform((raw, ctx) => {
    const result = parseWholeNumber(raw, label, min);
    if (!result.ok) {
      ctx.addIssue({ code: "custom", message: result.message });
      return z.NEVER;
    }
    return result.value;
  });
}

function requiredText(label: string) {
  return z.string().refine((v) => v !== "", { message: `${label}が空です` });
}

const rowSchema = z.object({
  order_date: z.string().transform((raw, ctx) => {
    const date = normalizeDate(raw);
    if (date === null) {
      ctx.addIssue({ code: "custom", message: "日付が読めません" });
      return z.NEVER;
    }
    return date;
  }),
  customer_id: z.string().transform((v) => (v === "" ? null : v)),
  product_name: requiredText("商品名"),
  category: requiredText("カテゴリ"),
  sku: requiredText("SKU"),
  quantity: wholeNumber("数量", 1),
  revenue: wholeNumber("売上", 0),
  cost: wholeNumber("原価", 0),
});

export type RowValidation =
  | { ok: true; row: SalesRow }
  | { ok: false; reason: string };

/** 1行（値は前後の空白を削り済み）を検証する。理由は全項目ぶんを集める */
export function validateRow(values: Record<CanonicalColumn, string>): RowValidation {
  const parsed = rowSchema.safeParse(values);
  if (!parsed.success) {
    const reasons = [...new Set(parsed.error.issues.map((i) => i.message))];
    return { ok: false, reason: reasons.join("／") };
  }
  const d = parsed.data;
  return {
    ok: true,
    row: {
      orderDate: d.order_date,
      customerId: d.customer_id,
      productName: d.product_name,
      category: d.category,
      sku: d.sku,
      quantity: d.quantity,
      revenue: d.revenue,
      cost: d.cost,
    },
  };
}

/** 成功行を対象月（YYYY-MM）ごとに分ける。月の昇順（architecture.md 第4項） */
export function groupRowsByMonth(rows: readonly SalesRow[]): MonthGroup[] {
  const map = new Map<string, SalesRow[]>();
  for (const row of rows) {
    const month = row.orderDate.slice(0, 7);
    const list = map.get(month);
    if (list) list.push(row);
    else map.set(month, [row]);
  }
  return [...map.keys()].sort().map((month) => ({ month, rows: map.get(month) ?? [] }));
}

// Excel で開いた時に式として実行されないよう、先頭が = + - @ の文字列には ' を付ける
function escapeFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

/** スキップ行CSV（先頭に BOM・理由の列つき）の文字列を作る。画面のダウンロードで使う */
export function buildSkippedRowsCsv(skipped: readonly SkippedRow[]): string {
  const fields = ["行番号", ...CANONICAL_COLUMNS, "理由"];
  const data = skipped.map((s) => [
    String(s.rowNumber),
    ...CANONICAL_COLUMNS.map((c) => escapeFormula(s.values[c])),
    escapeFormula(s.reason),
  ]);
  return `﻿${Papa.unparse({ fields, data }, { newline: "\r\n" })}`;
}
