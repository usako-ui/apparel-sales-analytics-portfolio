// ダッシュボードの画面の組み立て（CR-02 手順1）。データ0件の表示・月の選択・AI区画のスロットを確かめる
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DashboardReport } from "@/components/dashboard/DashboardReport";
import type { SalesRow } from "@/lib/csv/validate";

// 月の選択は画面遷移（useRouter）を使う。静的な描画では動かさないので差し替える
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }));

const row = (orderDate: string, revenue: number): SalesRow => ({
  orderDate,
  customerId: "c1",
  productName: "テスト商品",
  category: "トップス",
  sku: "SKU-1",
  quantity: 1,
  revenue,
  cost: 400,
});

// 2か月分（10月・11月）
const rows: SalesRow[] = [row("2025-10-05", 1000), row("2025-11-05", 2000)];

function render(overrides: Partial<Parameters<typeof DashboardReport>[0]> = {}) {
  return renderToStaticMarkup(
    createElement(DashboardReport, {
      rows,
      requestedMonth: undefined,
      requestedPeriod: undefined,
      renderAnalysis: (month) => createElement("p", null, `分析の区画:${month}`),
      ...overrides,
    }),
  );
}

describe("DashboardReport", () => {
  it("データ0件では、アップロードへの案内を出し、AI区画は出さない", () => {
    const html = render({ rows: [] });
    expect(html).toContain("売上データがまだありません");
    expect(html).toContain('href="/upload"');
    expect(html).not.toContain("分析の区画");
  });

  it("月の指定がなければ最新の月を表示し、その月をAI区画に渡す", () => {
    const html = render();
    expect(html).toContain("分析の区画:2025-11");
    expect(html).toContain("2,000");
  });

  it("?month= で選んだ月の数字を表示し、その月をAI区画に渡す", () => {
    const html = render({ requestedMonth: "2025-10" });
    expect(html).toContain("分析の区画:2025-10");
    expect(html).toContain("1,000");
  });

  it("不正な月・データのない月は最新の月になる", () => {
    expect(render({ requestedMonth: "abc" })).toContain("分析の区画:2025-11");
    expect(render({ requestedMonth: "2024-01" })).toContain("分析の区画:2025-11");
  });
});
