// CSV取り込み（lib/upload/import.ts）の単体テスト。DB はモック（実際のDBは tests/integration/upload.test.ts）
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { importSalesCsv, MAX_FILE_BYTES, previewSalesCsv, type UploadFile } from "@/lib/upload/import";

const HEADER = "order_date,customer_id,product_name,category,sku,quantity,revenue,cost";
const csv = (...lines: string[]) => [HEADER, ...lines].join("\n");
const file = (text: string, name = "sales.csv"): UploadFile => new File([text], name);

// 技術的な文が画面向けメッセージに混ざっていないか調べる語
const TECHNICAL = /duplicate|constraint|violat|unique|rpc|postgres|supabase|permission denied|42501|23505|PGRST|jwt|key/i;

type RpcError = { code?: string; message: string } | null;

function fakeDb(options: { existing?: string[]; readError?: boolean; rpcError?: RpcError } = {}) {
  const rpc = vi.fn(async () => ({ data: null, error: options.rpcError ?? null }));
  const query = {
    select: () => query,
    eq: () => query,
    in: async () => ({
      data: options.readError ? null : (options.existing ?? []).map((m) => ({ target_month: m })),
      error: options.readError ? { message: "connection refused to db.xxx.supabase.co" } : null,
    }),
  };
  const from = vi.fn(() => query);
  return { db: { from, rpc } as unknown as SupabaseClient, rpc, from };
}

const OK_ROW = "2025-09-01,c1,シャツ,トップス,SKU-1,1,1000,400";

describe("5MB の確認", () => {
  it("上限ちょうどは通り、1バイトでも超えると中身を読まずに拒否する", async () => {
    const big = { name: "big.csv", size: MAX_FILE_BYTES + 1, text: vi.fn(async () => csv(OK_ROW)) };
    const { db, rpc } = fakeDb();

    for (const run of [
      () => previewSalesCsv(db, "shop", big),
      () => importSalesCsv(db, "shop", big, true),
    ]) {
      const result = await run();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).toContain("5MB");
        expect(result.message).not.toMatch(TECHNICAL);
      }
    }
    expect(big.text).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();

    const exact = { name: "ok.csv", size: MAX_FILE_BYTES, text: async () => csv(OK_ROW) };
    expect((await previewSalesCsv(db, "shop", exact)).ok).toBe(true);
  });

  it("ファイルがない場合も日本語で拒否する", async () => {
    const { db } = fakeDb();
    const result = await importSalesCsv(db, "shop", null, true);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("ファイルが選ばれていません");
  });
});

describe("確認（プレビュー）", () => {
  it("成功行・スキップ行・対象月・上書きになる月を返し、DB に書かない", async () => {
    const { db, rpc } = fakeDb({ existing: ["2025-09"] });
    const text = csv(OK_ROW, "2025-10-02,c2,パンツ,ボトムス,SKU-2,2,3000,1200", "bad-date,c3,x,x,x,1,1,1");
    const result = await previewSalesCsv(db, "shop", file(text));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.successCount).toBe(2);
    expect(result.skipped).toHaveLength(1);
    expect(result.months).toEqual(["2025-09", "2025-10"]);
    expect(result.overwriteMonths).toEqual(["2025-09"]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("既存データの確認に失敗したら、技術的な文を出さずに止める", async () => {
    const { db } = fakeDb({ readError: true });
    const result = await previewSalesCsv(db, "shop", file(csv(OK_ROW)));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).not.toMatch(TECHNICAL);
  });
});

describe("上書きの確認", () => {
  it("すでにある月があり、上書きの指定がないと拒否する（DB関数を呼ばない）", async () => {
    const { db, rpc } = fakeDb({ existing: ["2025-09"] });
    const result = await importSalesCsv(db, "shop", file(csv(OK_ROW)), false);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("needsOverwrite");
    expect(result.overwriteMonths).toEqual(["2025-09"]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("上書きの指定があれば、DB関数を1回だけ呼ぶ（月ごとにまとめ、昇順）", async () => {
    const { db, rpc } = fakeDb({ existing: ["2025-09"] });
    const text = csv("2025-10-02,c2,パンツ,ボトムス,SKU-2,2,3000,1200", OK_ROW);
    const result = await importSalesCsv(db, "shop", file(text, "月次.csv"), true);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.overwriteMonths).toEqual(["2025-09"]);

    expect(rpc).toHaveBeenCalledTimes(1);
    const [name, args] = rpc.mock.calls[0] as unknown as [string, { p_filename: string; p_months: { target_month: string; rows: unknown[] }[] }];
    expect(name).toBe("replace_month_uploads");
    expect(args.p_filename).toBe("月次.csv");
    expect(args.p_months.map((m) => m.target_month)).toEqual(["2025-09", "2025-10"]);
    expect(args.p_months[0].rows[0]).toMatchObject({ order_date: "2025-09-01", sku: "SKU-1", revenue: 1000, cost: 400 });
  });

  it("既存の月がなければ、指定がなくても取り込める", async () => {
    const { db, rpc } = fakeDb({ existing: [] });
    const result = await importSalesCsv(db, "shop", file(csv(OK_ROW)), false);
    expect(result.ok).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});

describe("成功行が0件・形式の誤り", () => {
  it("全行スキップなら取り込まず、スキップ行を返す", async () => {
    const { db, rpc } = fakeDb();
    const result = await importSalesCsv(db, "shop", file(csv("bad,c1,x,x,x,1,1,1", "2025-09-01,c1,x,x,x,0,1,1")), true);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.skipped).toHaveLength(2);
    expect(result.message).not.toMatch(TECHNICAL);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("必須の列がない・空のファイルは日本語で停止する", async () => {
    const { db, rpc } = fakeDb();
    for (const text of ["order_date,sku\n2025-09-01,A", "", `${HEADER}\n`]) {
      const result = await importSalesCsv(db, "shop", file(text), true);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).not.toMatch(TECHNICAL);
    }
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("DB のエラーは日本語にする", () => {
  it.each([
    ["42501", "permission denied: no active shop"],
    ["23505", 'duplicate key value violates unique constraint "uploads_shop_id_target_month_key"'],
    ["XX000", "order_date does not belong to target_month 2025-09"],
    [undefined, "fetch failed: https://abc.supabase.co/rest/v1/rpc/replace_month_uploads"],
  ])("code=%s", async (code, message) => {
    const { db } = fakeDb({ rpcError: { code, message } });
    const result = await importSalesCsv(db, "shop", file(csv(OK_ROW)), true);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).not.toMatch(TECHNICAL);
    expect(result.message).not.toContain(message);
    expect(result.message).toMatch(/[ぁ-ん]/); // 日本語
  });
});
