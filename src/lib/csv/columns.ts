// 列名の別名と正規化（architecture.md 第11項）
// customer_email（個人情報）・name（注文番号）は別名に入れない → 取り込まずに捨てる

export const CANONICAL_COLUMNS = [
  "order_date",
  "customer_id",
  "product_name",
  "category",
  "sku",
  "quantity",
  "revenue",
  "cost",
] as const;

export type CanonicalColumn = (typeof CANONICAL_COLUMNS)[number];

/** customer_id だけは空欄・列なしでも取り込める */
export const REQUIRED_COLUMNS: readonly CanonicalColumn[] = CANONICAL_COLUMNS.filter(
  (c) => c !== "customer_id",
);

/** 画面・エラー文に出す日本語名 */
export const COLUMN_LABELS: Record<CanonicalColumn, string> = {
  order_date: "注文日",
  customer_id: "顧客ID",
  product_name: "商品名",
  category: "カテゴリ",
  sku: "SKU",
  quantity: "数量",
  revenue: "売上",
  cost: "原価",
};

const ALIASES: Record<CanonicalColumn, readonly string[]> = {
  order_date: ["order_date", "created_at", "date", "注文日", "日付"],
  customer_id: ["customer_id", "customer", "顧客id", "顧客"],
  product_name: ["product_name", "lineitem_name", "product", "商品名"],
  category: ["category", "product_type", "カテゴリ"],
  sku: ["sku", "lineitem_sku", "商品コード"],
  quantity: ["quantity", "lineitem_quantity", "qty", "数量"],
  revenue: ["revenue", "sales", "total", "売上", "金額"],
  cost: ["cost", "cost_of_goods", "原価"],
};

/** 前後の空白を削る・小文字にする・空白と - を _ にそろえる（BOM も除く） */
export function normalizeHeaderName(raw: string): string {
  return raw
    .replace(/^﻿/, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

const ALIAS_TO_CANONICAL: ReadonlyMap<string, CanonicalColumn> = new Map(
  CANONICAL_COLUMNS.flatMap((canonical) =>
    ALIASES[canonical].map((alias) => [alias, canonical] as const),
  ),
);

/** 見出しの1つを正式名へ。別名にない列（customer_email など）は null */
export function toCanonicalColumn(raw: string): CanonicalColumn | null {
  return ALIAS_TO_CANONICAL.get(normalizeHeaderName(raw)) ?? null;
}
