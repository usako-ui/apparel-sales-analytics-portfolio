import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { hasCourseCsv } from "../helpers/course-csv";

// T-03：テストの道具が動くことの確認を兼ねて、配布CSVが想定どおりの形かを固定する
describe.skipIf(!hasCourseCsv)("配布CSV（tests/fixtures/sample-sales.csv）", () => {
  // ファイルがない時も読み込みで落ちないよう、読む処理は skip されない時だけ（空文字で代用）
  const text = hasCourseCsv ? readFileSync(path.resolve(__dirname, "../fixtures/sample-sales.csv"), "utf8") : "";
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");

  it("必須列の見出しがそろっている", () => {
    expect(lines[0].replace(/^﻿/, "")).toBe(
      "order_date,customer_id,product_name,category,sku,quantity,revenue,cost",
    );
  });

  it("明細が40行ある", () => {
    expect(lines.length - 1).toBe(40);
  });
});
