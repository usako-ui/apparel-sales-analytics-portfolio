// DB の sales_data を読み、集計関数の入力（SalesRow[]）に変換する
// db は本人の権限（RLS が効く anon クライアント）を渡す。service role は使わない

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SalesRow } from "@/lib/csv/validate";

type SalesDataRecord = {
  order_date: string;
  customer_id: string | null;
  product_name: string;
  category: string;
  sku: string;
  quantity: number;
  revenue: number;
  cost: number;
};

// ページの区切りに使う id（sales_data.id は bigint の自動採番。JS では number）
type SalesDataRecordWithId = SalesDataRecord & { id: number };

const COLUMNS = "id, order_date, customer_id, product_name, category, sku, quantity, revenue, cost";
// Supabase は1回の取得が最大1000行のため、ページに分けて全件読む
const PAGE_SIZE = 1000;

export function toSalesRow(r: SalesDataRecord): SalesRow {
  return {
    orderDate: r.order_date,
    customerId: r.customer_id === null || r.customer_id === "" ? null : r.customer_id,
    productName: r.product_name,
    category: r.category,
    sku: r.sku,
    quantity: r.quantity,
    revenue: r.revenue,
    cost: r.cost,
  };
}

export type LoadSalesRowsResult = { ok: true; rows: SalesRow[] } | { ok: false; error: string };

/** お店（shopId）の売上データを全件読む。RLS により他のお店の行は返らない */
export async function loadSalesRows(db: SupabaseClient, shopId: string): Promise<LoadSalesRowsResult> {
  const rows: SalesRow[] = [];
  // 「何件目から」ではなく「前のページの最後の id より後」で読む（読み込み中に行が増減しても抜け・重複が出ない）
  let lastId: number | null = null;
  for (;;) {
    let query = db.from("sales_data").select(COLUMNS).eq("shop_id", shopId);
    if (lastId !== null) query = query.gt("id", lastId);
    const { data, error } = await query.order("id", { ascending: true }).limit(PAGE_SIZE);
    if (error) {
      return { ok: false, error: "売上データを読み込めませんでした。しばらくしてからもう一度お試しください" };
    }
    const page = (data ?? []) as unknown as SalesDataRecordWithId[];
    rows.push(...page.map(toSalesRow));
    if (page.length < PAGE_SIZE) break;
    lastId = page[page.length - 1].id;
  }
  return { ok: true, rows };
}
