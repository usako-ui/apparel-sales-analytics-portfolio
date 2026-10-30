// CSV文字列 → 検証済みの行（T-12・T-13 の入口）
// ファイルサイズ（5MB）の確認は呼び出し側（T-14）。ここは文字列だけを受け取る

import Papa from "papaparse";
import {
  CANONICAL_COLUMNS,
  COLUMN_LABELS,
  REQUIRED_COLUMNS,
  toCanonicalColumn,
  type CanonicalColumn,
} from "./columns";
import { validateRow, type SalesRow, type SkippedRow } from "./validate";

export type ParseSalesCsvResult =
  | {
      ok: true;
      rows: SalesRow[];
      skipped: SkippedRow[];
      /** 成功行に含まれる対象月（YYYY-MM・昇順） */
      months: string[];
    }
  | { ok: false; error: string };

type HeaderMap = Map<number, CanonicalColumn>;

function buildHeaderMap(header: readonly string[]): { map: HeaderMap } | { error: string } {
  const map: HeaderMap = new Map();
  const seen = new Set<CanonicalColumn>();
  const duplicated = new Set<CanonicalColumn>();
  header.forEach((raw, index) => {
    const canonical = toCanonicalColumn(raw);
    if (canonical === null) return; // 別名にない列は捨てる（customer_email など）
    if (seen.has(canonical)) duplicated.add(canonical);
    seen.add(canonical);
    map.set(index, canonical);
  });
  if (duplicated.size > 0) {
    const names = [...duplicated].map((c) => `${COLUMN_LABELS[c]}（${c}）`).join("、");
    return { error: `列名が重複しています：${names}` };
  }
  const missing = REQUIRED_COLUMNS.filter((c) => !seen.has(c));
  if (missing.length > 0) {
    const names = missing.map((c) => `${COLUMN_LABELS[c]}（${c}）`).join("、");
    return { error: `必須の列が見つかりません：${names}。CSVの1行目の列名を確認してください` };
  }
  return { map };
}

export function parseSalesCsv(text: string): ParseSalesCsvResult {
  const body = text.replace(/^﻿/, "");
  if (body.trim() === "") {
    return { ok: false, error: "CSVが空です。データの入ったファイルを選んでください" };
  }

  // header:false で配列として読み、元の行番号（配列の位置＋1）を保つ
  const parsed = Papa.parse<string[]>(body, { header: false, skipEmptyLines: false });
  const lines = parsed.data;
  const headerMapResult = buildHeaderMap(lines[0] ?? []);
  if ("error" in headerMapResult) return { ok: false, error: headerMapResult.error };
  const { map } = headerMapResult;

  const rows: SalesRow[] = [];
  const skipped: SkippedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i];
    if (cells.every((c) => c.trim() === "")) continue; // 空行・末尾の改行

    const values = Object.fromEntries(CANONICAL_COLUMNS.map((c) => [c, ""])) as Record<
      CanonicalColumn,
      string
    >;
    for (const [index, canonical] of map) {
      values[canonical] = (cells[index] ?? "").trim();
    }

    const result = validateRow(values);
    if (result.ok) rows.push(result.row);
    else skipped.push({ rowNumber: i + 1, values, reason: result.reason });
  }

  if (rows.length === 0 && skipped.length === 0) {
    return { ok: false, error: "CSVにデータの行がありません。列名だけのファイルは取り込めません" };
  }

  const months = [...new Set(rows.map((r) => r.orderDate.slice(0, 7)))].sort();
  return { ok: true, rows, skipped, months };
}
