import { readFileSync } from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import { describe, expect, it } from "vitest";
import { normalizeDate } from "@/lib/csv/normalize";
import { parseSalesCsv } from "@/lib/csv/parse";
import { buildSkippedRowsCsv, groupRowsByMonth } from "@/lib/csv/validate";
import { hasCourseCsv } from "../helpers/course-csv";

const fixture = (name: string) =>
  readFileSync(path.resolve(__dirname, "../fixtures", name), "utf8");

function expectOk(result: ReturnType<typeof parseSalesCsv>) {
  if (!result.ok) throw new Error(`取り込みに失敗: ${result.error}`);
  return result;
}

describe.skipIf(!hasCourseCsv)("配布CSV（AC-01）", () => {
  // ファイルがない時に読み込みで落ちないよう、読む処理は各テストの中まで遅らせる
  const load = () => expectOk(parseSalesCsv(fixture("sample-sales.csv")));

  it("40行成功・0行スキップ", () => {
    const result = load();
    expect(result.rows).toHaveLength(40);
    expect(result.skipped).toHaveLength(0);
  });

  it("9・10・11月に分かれ、合計が40行", () => {
    const result = load();
    expect(result.months).toEqual(["2025-09", "2025-10", "2025-11"]);
    const groups = groupRowsByMonth(result.rows);
    expect(groups.map((g) => g.month)).toEqual(["2025-09", "2025-10", "2025-11"]);
    expect(groups.reduce((sum, g) => sum + g.rows.length, 0)).toBe(40);
    for (const g of groups) {
      expect(g.rows.every((r) => r.orderDate.startsWith(g.month))).toBe(true);
    }
  });

  it("金額・数量は整数で、先頭行の値が合う", () => {
    const result = load();
    expect(result.rows[0]).toEqual({
      orderDate: "2025-09-03",
      customerId: "C001",
      productName: "オーガニックコットンTシャツ",
      category: "トップス",
      sku: "LUM-TOP-01",
      quantity: 2,
      revenue: 7600,
      cost: 2800,
    });
    expect(result.rows.every((r) => Number.isInteger(r.revenue) && Number.isInteger(r.cost))).toBe(true);
  });
});

describe("読み取り（別名・日付・BOM）", () => {
  it("別名の列名・YYYY/MM/DD・時刻付きが読める。メール列は捨てる", () => {
    const result = expectOk(parseSalesCsv(fixture("alias-headers.csv")));
    expect(result.skipped).toHaveLength(0);
    expect(result.rows.map((r) => r.orderDate)).toEqual(["2025-09-03", "2025-10-15", "2025-11-01"]);
    expect(result.rows[0].productName).toBe("オーガニックコットンTシャツ");
    expect(result.rows[0].revenue).toBe(7600);
    expect(JSON.stringify(result.rows)).not.toContain("example.com");
  });

  it.skipIf(!hasCourseCsv)("BOM付きでも読める", () => {
    const result = expectOk(parseSalesCsv(`﻿${fixture("sample-sales.csv")}`));
    expect(result.rows).toHaveLength(40);
  });

  it.skipIf(!hasCourseCsv)("CRLF・末尾の空行があっても読める", () => {
    const text = fixture("sample-sales.csv").replace(/\r?\n/g, "\r\n") + "\r\n\r\n";
    const result = expectOk(parseSalesCsv(text));
    expect(result.rows).toHaveLength(40);
    expect(result.skipped).toHaveLength(0);
  });

  it("customer_id の列がなくても読める（null）", () => {
    const text = [
      "order_date,product_name,category,sku,quantity,revenue,cost",
      "2025-09-03,A,トップス,S1,1,1000,400",
    ].join("\n");
    const result = expectOk(parseSalesCsv(text));
    expect(result.rows[0].customerId).toBeNull();
  });
});

describe("読み取り（自作 CSV・BOM・CRLF）", () => {
  // 配布 CSV がなくても常に実行される。素の読み取り結果と同じになることを確かめる
  const plain = () => expectOk(parseSalesCsv(fixture("lumina-sample-sales.csv")));

  function expectSameAsPlain(result: ReturnType<typeof expectOk>) {
    const base = plain();
    expect(result.rows).toHaveLength(48);
    expect(result.skipped).toHaveLength(0);
    expect(result.rows[0]).toEqual(base.rows[0]);
    expect(result.rows[result.rows.length - 1]).toEqual(base.rows[base.rows.length - 1]);
    expect(result.rows).toEqual(base.rows);
    expect(result.months).toEqual(base.months);
  }

  it("自作 CSV：BOM付きでも同じ結果になる", () => {
    expectSameAsPlain(expectOk(parseSalesCsv(`﻿${fixture("lumina-sample-sales.csv")}`)));
  });

  it("自作 CSV：CRLF・末尾の空行があっても同じ結果になる", () => {
    const text = fixture("lumina-sample-sales.csv").replace(/\r?\n/g, "\r\n") + "\r\n\r\n";
    expectSameAsPlain(expectOk(parseSalesCsv(text)));
  });
});

describe("停止するケース", () => {
  it("必須列がないと取り込まず、足りない列名を日本語で返す", () => {
    const result = parseSalesCsv(fixture("missing-columns.csv"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("必須の列が見つかりません");
      expect(result.error).toContain("sku");
      expect(result.error).toContain("売上");
      expect(result.error).toContain("原価");
      expect(result.error).not.toContain("数量");
    }
  });

  it("同じ正式名に当たる列が2つあると停止する", () => {
    const result = parseSalesCsv(fixture("duplicate-columns.csv"));
    expect(result).toEqual({
      ok: false,
      error: expect.stringContaining("列名が重複しています：注文日（order_date）"),
    });
  });

  it("空のファイル・列名だけのファイルは停止する", () => {
    expect(parseSalesCsv("").ok).toBe(false);
    expect(parseSalesCsv("order_date,product_name,category,sku,quantity,revenue,cost\n").ok).toBe(false);
  });
});

describe("不正行のスキップ（AC-02）", () => {
  const result = expectOk(parseSalesCsv(fixture("invalid-rows.csv")));
  const reasonOf = (rowNumber: number) =>
    result.skipped.find((s) => s.rowNumber === rowNumber)?.reason;

  it("不正な行だけがスキップされ、正しい行は取り込まれる", () => {
    expect(result.rows.map((r) => r.sku)).toEqual(["LUM-TOP-01", "LUM-TOP-04"]);
    expect(result.skipped.map((s) => s.rowNumber)).toEqual([3, 4, 5, 6, 7, 9, 10]);
  });

  it("理由が日本語で、行番号は元ファイルの行（見出しが1行目）", () => {
    expect(reasonOf(3)).toBe("日付が読めません");
    expect(reasonOf(4)).toBe("数量は1以上にしてください");
    expect(reasonOf(5)).toBe("数量が整数ではありません");
    expect(reasonOf(6)).toBe("売上が整数ではありません");
    expect(reasonOf(7)).toBe("商品名が空です");
    expect(reasonOf(9)).toBe("売上は0以上にしてください");
    expect(reasonOf(10)).toBe("日付が読めません");
  });

  it("7600.0 は可・customer_id 空欄は null", () => {
    const row = result.rows.find((r) => r.sku === "LUM-TOP-04");
    expect(row?.revenue).toBe(9000);
    expect(row?.customerId).toBeNull();
  });

  it("スキップ行は元の値を持つが、メールは持たない", () => {
    const skipped = result.skipped[0];
    expect(skipped.values.order_date).toBe("2025-13-05");
    expect(skipped.values.product_name).toBe("ダウンジャケット");
    expect(JSON.stringify(result.skipped)).not.toContain("example.com");
  });

  it("複数の問題がある行は理由を「／」でつなぐ", () => {
    const text = [
      "order_date,product_name,category,sku,quantity,revenue,cost",
      "bad,,トップス,S1,0,1000,400",
    ].join("\n");
    const r = expectOk(parseSalesCsv(text));
    expect(r.skipped[0].reason).toBe("日付が読めません／商品名が空です／数量は1以上にしてください");
  });

  it("小数点以下が0だけの金額（7600.00）は可、数値でない値は理由つきでスキップ", () => {
    const text = [
      "order_date,product_name,category,sku,quantity,revenue,cost",
      "2025-09-03,A,トップス,S1,1,7600.00,400",
      "2025-09-03,A,トップス,S2,1,abc,400",
      "2025-09-03,A,トップス,S3,1,99999999999,400",
    ].join("\n");
    const r = expectOk(parseSalesCsv(text));
    expect(r.rows).toHaveLength(1);
    expect(r.skipped.map((s) => s.reason)).toEqual(["売上が数値ではありません", "売上が大きすぎます"]);
  });
});

describe("スキップ行CSV", () => {
  const result = expectOk(parseSalesCsv(fixture("invalid-rows.csv")));
  const csv = buildSkippedRowsCsv(result.skipped);

  it("理由の列が付き、元の値と行番号が入る", () => {
    const parsed = Papa.parse<string[]>(csv.replace(/^﻿/, ""), { header: false });
    const header = parsed.data[0];
    expect(header[0]).toBe("行番号");
    expect(header[header.length - 1]).toBe("理由");
    expect(parsed.data[1][0]).toBe("3");
    expect(parsed.data[1][header.length - 1]).toBe("日付が読めません");
    expect(parsed.data[1]).toContain("ダウンジャケット");
  });

  it("Excel で開ける BOM 付きで、メールは含まない", () => {
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).not.toContain("example.com");
  });

  it("式として実行されうる値（= + - @ で始まる）は ' を付ける", () => {
    const out = buildSkippedRowsCsv([
      {
        rowNumber: 2,
        values: {
          order_date: "x",
          customer_id: "",
          product_name: "=1+1",
          category: "c",
          sku: "s",
          quantity: "1",
          revenue: "-5",
          cost: "1",
        },
        reason: "テスト",
      },
    ]);
    expect(out).toContain("'=1+1");
    expect(out).toContain("'-5");
  });
});

describe("日付の正規化（文字列だけで判定）", () => {
  it("2形式・1桁・時刻付きを YYYY-MM-DD にする", () => {
    expect(normalizeDate("2025-09-03")).toBe("2025-09-03");
    expect(normalizeDate("2025/9/3")).toBe("2025-09-03");
    expect(normalizeDate("2025/09/03")).toBe("2025-09-03");
    expect(normalizeDate("2025-11-01 10:00:00 +0900")).toBe("2025-11-01");
    expect(normalizeDate("2025-11-01T10:00:00")).toBe("2025-11-01");
    expect(normalizeDate("  2025-11-01 ")).toBe("2025-11-01");
  });

  it("うるう年の 2/29 は可、平年は不可", () => {
    expect(normalizeDate("2024-02-29")).toBe("2024-02-29");
    expect(normalizeDate("2000-02-29")).toBe("2000-02-29");
    expect(normalizeDate("2025-02-29")).toBeNull();
    expect(normalizeDate("1900-02-29")).toBeNull();
  });

  it("実在しない日付・読めない形は null", () => {
    expect(normalizeDate("2025-13-01")).toBeNull();
    expect(normalizeDate("2025-00-10")).toBeNull();
    expect(normalizeDate("2025-02-30")).toBeNull();
    expect(normalizeDate("2025-04-31")).toBeNull();
    expect(normalizeDate("2025-09-00")).toBeNull();
    expect(normalizeDate("2025-09/03")).toBeNull();
    expect(normalizeDate("09/03/2025")).toBeNull();
    expect(normalizeDate("")).toBeNull();
    expect(normalizeDate("2025-09-03abc")).toBeNull();
  });
});
