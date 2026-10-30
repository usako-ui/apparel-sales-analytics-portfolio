// SKUトップ10（T-18）。入力は行の配列だけ

import type { SalesRow } from "@/lib/csv/validate";
import { compareText, rowsInPeriod, type DisplayPeriod } from "./period";

export const SKU_TOP_LIMIT = 10;

export type SkuSales = {
  sku: string;
  productName: string;
  category: string;
  quantity: number; // 点数の合計
  revenue: number; // 円（整数）
};

/**
 * 表示期間の数量合計が多い順に最大10件。
 * 並び：数量の多い順 → 同数なら売上の多い順 → それも同じなら SKU の文字順。
 * 同じ SKU で商品名・カテゴリが複数ある場合は、表示期間内で最も新しい order_date の行の値を使う
 * （同じ日付なら先に出てきた行）。
 */
export function calcSkuTop(rows: readonly SalesRow[], period: DisplayPeriod): SkuSales[] {
  const bySku = new Map<string, SkuSales & { latestDate: string }>();
  for (const row of rowsInPeriod(rows, period)) {
    const current = bySku.get(row.sku);
    if (!current) {
      bySku.set(row.sku, {
        sku: row.sku,
        productName: row.productName,
        category: row.category,
        quantity: row.quantity,
        revenue: row.revenue,
        latestDate: row.orderDate,
      });
      continue;
    }
    current.quantity += row.quantity;
    current.revenue += row.revenue;
    if (row.orderDate > current.latestDate) {
      current.latestDate = row.orderDate;
      current.productName = row.productName;
      current.category = row.category;
    }
  }

  return [...bySku.values()]
    .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue || compareText(a.sku, b.sku))
    .slice(0, SKU_TOP_LIMIT)
    .map(({ sku, productName, category, quantity, revenue }) => ({ sku, productName, category, quantity, revenue }));
}
