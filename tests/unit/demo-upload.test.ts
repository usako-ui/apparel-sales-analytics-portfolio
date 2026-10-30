// デモ版の「確認」「取り込み」（demo/components/demo-upload.ts）の単体テスト。保存先はメモリのストアを使う
import { describe, expect, it, vi } from "vitest";
import {
  createDemoUploadActions,
  fetchSampleCsv,
  SAMPLE_CSV_NAME,
  SAMPLE_CSV_PATH,
} from "../../demo/components/demo-upload";
import { createDemoStore } from "../../demo/lib/store";

const HEADER = "注文日,顧客ID,商品名,カテゴリ,SKU,数量,売上,原価";
const line = (date: string, customer: string) => `${date},${customer},ベーシックTシャツ,トップス,SKU-001,1,3000,1200`;

function csvFile(name: string, lines: string[]): File {
  return new File([[HEADER, ...lines].join("\n")], name, { type: "text/csv" });
}

function formOf(file: File | null, overwrite = false): FormData {
  const formData = new FormData();
  if (file) formData.set("file", file);
  if (overwrite) formData.set("overwrite", "true");
  return formData;
}

function setup() {
  const store = createDemoStore(null); // メモリだけ
  const onSaved = vi.fn();
  const actions = createDemoUploadActions(store, onSaved);
  return { store, onSaved, actions };
}

describe("確認（preview）", () => {
  it("保存はせず、成功行・対象月を返す。保存済みの月がなければ上書きなし", async () => {
    const { store, actions, onSaved } = setup();
    const result = await actions.preview(formOf(csvFile("a.csv", [line("2025-10-03", "C-1"), line("2025-11-05", "C-2")])));

    expect(result).toMatchObject({ ok: true, fileName: "a.csv", successCount: 2, months: ["2025-10", "2025-11"], overwriteMonths: [] });
    expect(store.loadRows()).toHaveLength(0);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("すでにある月は上書きになる月として返す", async () => {
    const { store, actions } = setup();
    store.replaceMonths([
      { orderDate: "2025-10-01", customerId: "C-9", productName: "x", category: "トップス", sku: "S", quantity: 1, revenue: 100, cost: 50 },
    ]);
    const result = await actions.preview(formOf(csvFile("a.csv", [line("2025-10-03", "C-1"), line("2025-11-05", "C-2")])));

    expect(result).toMatchObject({ ok: true, overwriteMonths: ["2025-10"] });
  });

  it("ファイルがない・読めないCSVは失敗（日本語の message）", async () => {
    const { actions } = setup();
    const none = await actions.preview(formOf(null));
    expect(none).toMatchObject({ ok: false, code: "error" });
    const broken = await actions.preview(formOf(new File(["abc"], "b.csv")));
    expect(broken.ok).toBe(false);
  });
});

describe("取り込み（import）", () => {
  it("新しい月はそのまま保存し、onSaved を呼ぶ", async () => {
    const { store, actions, onSaved } = setup();
    const result = await actions.import(formOf(csvFile("a.csv", [line("2025-10-03", "C-1")])));

    expect(result).toMatchObject({ ok: true, successCount: 1, overwriteMonths: [] });
    expect(store.existingMonths()).toEqual(["2025-10"]);
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledWith(false); // メモリだけのストア
  });

  it("すでにある月は、overwrite がなければ拒否して何も変えない", async () => {
    const { store, actions, onSaved } = setup();
    await actions.import(formOf(csvFile("a.csv", [line("2025-10-03", "C-1")])));
    onSaved.mockClear();

    const result = await actions.import(formOf(csvFile("b.csv", [line("2025-10-20", "C-2"), line("2025-10-21", "C-3")])));

    expect(result).toMatchObject({ ok: false, code: "needsOverwrite", overwriteMonths: ["2025-10"] });
    expect(store.loadRows()).toHaveLength(1);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("overwrite が \"true\" なら、その月の行を入れ替える", async () => {
    const { store, actions } = setup();
    await actions.import(formOf(csvFile("a.csv", [line("2025-10-03", "C-1")])));

    const result = await actions.import(formOf(csvFile("b.csv", [line("2025-10-20", "C-2"), line("2025-10-21", "C-3")]), true));

    expect(result).toMatchObject({ ok: true, successCount: 2, overwriteMonths: ["2025-10"] });
    expect(store.loadRows().map((r) => r.customerId)).toEqual(["C-2", "C-3"]);
  });

  it("overwrite に \"true\" 以外が入っていても上書きしない", async () => {
    const { actions } = setup();
    await actions.import(formOf(csvFile("a.csv", [line("2025-10-03", "C-1")])));
    const formData = formOf(csvFile("b.csv", [line("2025-10-20", "C-2")]));
    formData.set("overwrite", "yes");

    expect(await actions.import(formData)).toMatchObject({ ok: false, code: "needsOverwrite" });
  });

  it("パースできないCSVは保存しない", async () => {
    const { store, actions, onSaved } = setup();
    const result = await actions.import(formOf(new File(["abc"], "b.csv")));

    expect(result.ok).toBe(false);
    expect(store.loadRows()).toHaveLength(0);
    expect(onSaved).not.toHaveBeenCalled();
  });
});

describe("ダミーCSVの取得（fetchSampleCsv）", () => {
  it("同梱のパスを取得し、決まった名前の File にする", async () => {
    const fetcher = vi.fn(async () => new Response("a,b\n1,2", { status: 200 }));
    const file = await fetchSampleCsv(fetcher as unknown as typeof fetch);

    expect(fetcher).toHaveBeenCalledWith(SAMPLE_CSV_PATH, { cache: "no-store" });
    expect(file?.name).toBe(SAMPLE_CSV_NAME);
    expect(await file?.text()).toBe("a,b\n1,2");
  });

  it("取得に失敗（HTTP エラー・通信エラー）したら null", async () => {
    const notFound = vi.fn(async () => new Response("", { status: 404 }));
    expect(await fetchSampleCsv(notFound as unknown as typeof fetch)).toBeNull();
    const offline = vi.fn(async () => {
      throw new TypeError("offline");
    });
    expect(await fetchSampleCsv(offline as unknown as typeof fetch)).toBeNull();
  });
});
