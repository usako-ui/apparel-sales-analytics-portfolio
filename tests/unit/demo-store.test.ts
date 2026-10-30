// デモ版のブラウザ内保存（demo/lib/store.ts）の単体テスト。ストレージは偽物（モック）に差し替える
import { describe, expect, it, vi } from "vitest";
import type { SalesRow } from "@/lib/csv/validate";
import {
  createDemoStore,
  mergeMonths,
  parseStoredRows,
  STORAGE_KEY,
  type StorageLike,
} from "../../demo/lib/store";

function row(orderDate: string, customerId: string | null = "CUST-A", revenue = 1000): SalesRow {
  return { orderDate, customerId, productName: "商品", category: "トップス", sku: "S-1", quantity: 1, revenue, cost: 400 };
}

/** 偽の localStorage。limit を超える文字数を入れようとすると QuotaExceededError を投げる */
function fakeStorage(options: { limit?: number; initial?: string } = {}) {
  const data = new Map<string, string>();
  if (options.initial !== undefined) data.set(STORAGE_KEY, options.initial);
  const storage = {
    getItem: vi.fn((k: string) => data.get(k) ?? null),
    setItem: vi.fn((k: string, v: string) => {
      if (options.limit !== undefined && v.length > options.limit) {
        throw new DOMException("quota", "QuotaExceededError");
      }
      data.set(k, v);
    }),
    removeItem: vi.fn((k: string) => {
      data.delete(k);
    }),
  } satisfies StorageLike;
  return { storage, data };
}

describe("キー名", () => {
  it("バージョン付きのキー", () => {
    expect(STORAGE_KEY).toBe("lumina-demo-sales-v1");
  });
});

describe("入れ替え・上書き", () => {
  it("最初は空。保存すると月が分かり、ストレージにも書かれる", () => {
    const { storage, data } = fakeStorage();
    const store = createDemoStore(storage);
    expect(store.loadRows()).toEqual([]);
    expect(store.existingMonths()).toEqual([]);

    const result = store.replaceMonths([row("2025-10-05"), row("2025-09-01")]);
    expect(result).toEqual({ persisted: true });
    expect(store.existingMonths()).toEqual(["2025-09", "2025-10"]);
    expect(store.loadRows().map((r) => r.orderDate)).toEqual(["2025-09-01", "2025-10-05"]); // 日付順
    expect(JSON.parse(data.get(STORAGE_KEY) ?? "null")).toHaveLength(2);
  });

  it("同じ月は入れ替わり（二重計上しない）、ほかの月は残る", () => {
    const store = createDemoStore(fakeStorage().storage);
    store.replaceMonths([row("2025-09-01", "CUST-A", 100), row("2025-09-02", "CUST-B", 200), row("2025-10-01", "CUST-A", 300)]);
    store.replaceMonths([row("2025-09-15", "CUST-C", 999)]);
    const rows = store.loadRows();
    expect(rows.map((r) => [r.orderDate, r.revenue])).toEqual([
      ["2025-09-15", 999], // 9月は新しい1行だけ
      ["2025-10-01", 300], // 10月はそのまま
    ]);
  });

  it("保存したデータは、別のストアを作り直しても読み出せる（再読み込み）", () => {
    const { storage } = fakeStorage();
    createDemoStore(storage).replaceMonths([row("2025-11-03")]);
    const again = createDemoStore(storage);
    expect(again.existingMonths()).toEqual(["2025-11"]);
    expect(again.persisted).toBe(true);
  });

  it("loadRows が返す配列を書き換えても、保存内容は変わらない", () => {
    const store = createDemoStore(fakeStorage().storage);
    store.replaceMonths([row("2025-09-01")]);
    store.loadRows().length = 0;
    expect(store.loadRows()).toHaveLength(1);
  });

  it("mergeMonths は純粋：元の配列を書き換えない", () => {
    const existing = [row("2025-09-01")];
    const incoming = [row("2025-09-02")];
    const merged = mergeMonths(existing, incoming);
    expect(merged.map((r) => r.orderDate)).toEqual(["2025-09-02"]);
    expect(existing.map((r) => r.orderDate)).toEqual(["2025-09-01"]);
  });
});

describe("上限超え → メモリだけに切り替え", () => {
  it("setItem が QuotaExceededError でも例外を出さず、persisted:false を返し、データは使い続けられる", () => {
    const { storage } = fakeStorage({ limit: 10 });
    const store = createDemoStore(storage);
    expect(store.persisted).toBe(true);

    const result = store.replaceMonths([row("2025-09-01"), row("2025-09-02")]);
    expect(result).toEqual({ persisted: false });
    expect(store.persisted).toBe(false);
    expect(store.loadRows()).toHaveLength(2); // メモリには入っている
    expect(store.existingMonths()).toEqual(["2025-09"]);
  });

  it("ストレージが使えない環境（null）でもメモリだけで動く", () => {
    const store = createDemoStore(null);
    expect(store.persisted).toBe(false);
    expect(store.replaceMonths([row("2025-09-01")])).toEqual({ persisted: false });
    expect(store.loadRows()).toHaveLength(1);
  });

  it("読み取りで例外になるストレージでも空で始まり、例外を出さない", () => {
    const { storage } = fakeStorage();
    storage.getItem.mockImplementation(() => {
      throw new Error("blocked");
    });
    const store = createDemoStore(storage);
    expect(store.loadRows()).toEqual([]);
    expect(store.persisted).toBe(false);
  });
});

describe("壊れた保存データ", () => {
  it.each([
    ["JSON ではない文字列", "{not json"],
    ["配列ではない", '{"a":1}'],
    ["行の形が違う", '[{"orderDate":"2025-09-01"}]'],
    ["日付の形が違う", JSON.stringify([{ ...row("2025/09/01") }])],
    ["金額が小数", JSON.stringify([{ ...row("2025-09-01"), revenue: 10.5 }])],
  ])("%s：捨てて空にする（例外なし）", (_name, initial) => {
    const { storage, data } = fakeStorage({ initial });
    const store = createDemoStore(storage);
    expect(store.loadRows()).toEqual([]);
    expect(store.existingMonths()).toEqual([]);
    expect(data.has(STORAGE_KEY)).toBe(false); // 壊れたデータは消す
    expect(store.replaceMonths([row("2025-09-01")])).toEqual({ persisted: true }); // その後は普通に保存できる
  });

  it("parseStoredRows：なし→空配列、正しい JSON→行、壊れたもの→null", () => {
    expect(parseStoredRows(null)).toEqual([]);
    expect(parseStoredRows(JSON.stringify([row("2025-09-01", null)]))).toEqual([row("2025-09-01", null)]);
    expect(parseStoredRows("oops")).toBeNull();
  });
});

describe("clearAll", () => {
  it("全部消え、ストレージのキーも消える。メモリだけになっていた後でも空になる", () => {
    const { storage, data } = fakeStorage();
    const store = createDemoStore(storage);
    store.replaceMonths([row("2025-09-01"), row("2025-10-01")]);
    store.clearAll();
    expect(store.loadRows()).toEqual([]);
    expect(store.existingMonths()).toEqual([]);
    expect(data.has(STORAGE_KEY)).toBe(false);
    expect(store.persisted).toBe(true);

    const full = createDemoStore(fakeStorage({ limit: 10 }).storage);
    full.replaceMonths([row("2025-09-01")]);
    expect(full.persisted).toBe(false);
    full.clearAll();
    expect(full.loadRows()).toEqual([]);
  });

  it("removeItem が例外でも落ちない（persisted:false）", () => {
    const { storage } = fakeStorage();
    storage.removeItem.mockImplementation(() => {
      throw new Error("blocked");
    });
    const store = createDemoStore(storage);
    store.replaceMonths([row("2025-09-01")]);
    expect(() => store.clearAll()).not.toThrow();
    expect(store.loadRows()).toEqual([]);
    expect(store.persisted).toBe(false);
  });
});
