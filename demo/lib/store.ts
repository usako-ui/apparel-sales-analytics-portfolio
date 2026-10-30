// デモ版のデータ保存（ブラウザ内）。SalesRow[] を localStorage に JSON で保存する
// - 同じ月の行は入れ替える（本番の「上書き」と同じ意味）
// - 上限超え（QuotaExceededError など）や保存できない環境では、メモリだけに切り替える。
//   その時 persisted が false になるので、画面は「このタブを閉じるまで保存されます」を出す
// - 壊れた JSON・形の違うデータは捨てて空にする（例外を画面に出さない）
// - ストレージは引数で差し替えられる（テストでモックを使う）
import type { SalesRow } from "@/lib/csv/validate";

/** 保存先のキー。保存する形を変える時は v2 に上げる（古い形を読まないため） */
export const STORAGE_KEY = "lumina-demo-sales-v1";

/** localStorage のうち、この保存が使う部分だけ */
export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const monthOfRow = (row: SalesRow): string => row.orderDate.slice(0, 7);

const isWhole = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v);

/** 保存データの1行が SalesRow の形か（保存の中身は信用しない） */
function isSalesRow(v: unknown): v is SalesRow {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.orderDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(r.orderDate) &&
    (r.customerId === null || typeof r.customerId === "string") &&
    typeof r.productName === "string" &&
    typeof r.category === "string" &&
    typeof r.sku === "string" &&
    isWhole(r.quantity) &&
    isWhole(r.revenue) &&
    isWhole(r.cost)
  );
}

/** 保存文字列 → 行。空・壊れた JSON・形の違うものは null（呼び出し側で捨てる） */
export function parseStoredRows(raw: string | null): SalesRow[] | null {
  if (raw === null) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data) || !data.every(isSalesRow)) return null;
    return data;
  } catch {
    return null;
  }
}

/** すでにある行のうち、新しい行と同じ月のものを除き、新しい行を足す（注文日の昇順・同じ日は元の順） */
export function mergeMonths(existing: readonly SalesRow[], incoming: readonly SalesRow[]): SalesRow[] {
  const replaced = new Set(incoming.map(monthOfRow));
  const kept = existing.filter((r) => !replaced.has(monthOfRow(r)));
  return [...kept, ...incoming].sort((a, b) => (a.orderDate < b.orderDate ? -1 : a.orderDate > b.orderDate ? 1 : 0));
}

/** 行に含まれる月（YYYY-MM・昇順） */
export function monthsOf(rows: readonly SalesRow[]): string[] {
  return [...new Set(rows.map(monthOfRow))].sort();
}

export type DemoStore = {
  /** 保存されている全行（コピーを返す） */
  loadRows(): SalesRow[];
  /** 同じ月の行を入れ替えて保存する。戻り値の persisted が false ならメモリだけ */
  replaceMonths(rows: readonly SalesRow[]): { persisted: boolean };
  /** データのある月（YYYY-MM・昇順） */
  existingMonths(): string[];
  /** 全データを消す */
  clearAll(): void;
  /** ブラウザに保存できている間は true。メモリだけになったら false */
  readonly persisted: boolean;
};

/** storage が null（使えない環境）ならメモリだけで動く */
export function createDemoStore(storage: StorageLike | null): DemoStore {
  let rows: SalesRow[] | null = null; // 読み込み前は null
  let persisted = storage !== null;

  function ensureLoaded(): SalesRow[] {
    if (rows !== null) return rows;
    if (storage === null) {
      rows = [];
      return rows;
    }
    let raw: string | null = null;
    try {
      raw = storage.getItem(STORAGE_KEY);
    } catch {
      persisted = false; // 読めない環境：メモリだけで続ける
      rows = [];
      return rows;
    }
    const parsed = parseStoredRows(raw);
    if (parsed === null) {
      // 壊れたデータは捨てて空にする
      try {
        storage.removeItem(STORAGE_KEY);
      } catch {
        // 消せなくても続ける
      }
      rows = [];
    } else {
      rows = parsed;
    }
    return rows;
  }

  function write(next: SalesRow[]): void {
    rows = next;
    if (storage === null) {
      persisted = false;
      return;
    }
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(next));
      persisted = true;
    } catch {
      // 上限超えなど：メモリだけに切り替える（rows には入っているので画面は動く）
      persisted = false;
    }
  }

  return {
    loadRows: () => [...ensureLoaded()],
    replaceMonths(incoming) {
      write(mergeMonths(ensureLoaded(), incoming));
      return { persisted };
    },
    existingMonths: () => monthsOf(ensureLoaded()),
    clearAll() {
      rows = [];
      if (storage === null) {
        persisted = false;
        return;
      }
      try {
        storage.removeItem(STORAGE_KEY);
        persisted = true;
      } catch {
        persisted = false;
      }
    },
    get persisted() {
      return persisted;
    },
  };
}

/** ブラウザの localStorage を使うストア。使えない環境（プライベートモード等）ではメモリだけ */
export function createBrowserStore(): DemoStore {
  let storage: StorageLike | null = null;
  try {
    storage = typeof window === "undefined" ? null : window.localStorage;
  } catch {
    storage = null; // アクセスだけで例外になるブラウザ設定がある
  }
  return createDemoStore(storage);
}
