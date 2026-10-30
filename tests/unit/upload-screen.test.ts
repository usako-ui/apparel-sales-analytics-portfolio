// CSVアップロード画面の、画面側の小さな関数（T-15）
import { describe, expect, it } from "vitest";
import { checkSelectedFile, FILE_TOO_LARGE_MESSAGE, NOT_CSV_MESSAGE } from "@/components/upload/check-file";
import { skippedFileName } from "@/components/upload/download-skipped";
import { formatMonthLabel, formatMonthList } from "@/components/upload/month-label";
import { MAX_FILE_BYTES } from "@/lib/upload/import";

describe("checkSelectedFile（送る前の確認）", () => {
  it("5MB ちょうどは通り、1バイトでも超えると止める（サーバーと同じ定数）", () => {
    expect(checkSelectedFile({ name: "a.csv", size: MAX_FILE_BYTES })).toBeNull();
    expect(checkSelectedFile({ name: "a.csv", size: MAX_FILE_BYTES + 1 })).toBe(FILE_TOO_LARGE_MESSAGE);
  });

  it("サーバー側の5MBのメッセージと同じ趣旨（上限は5MB・分けて選び直す）", () => {
    expect(FILE_TOO_LARGE_MESSAGE).toContain("5MB");
    expect(FILE_TOO_LARGE_MESSAGE).toContain("もう一度選んでください");
  });

  it(".csv 以外は止める（大文字の拡張子は通す）", () => {
    expect(checkSelectedFile({ name: "売上.xlsx", size: 10 })).toBe(NOT_CSV_MESSAGE);
    expect(checkSelectedFile({ name: "売上", size: 10 })).toBe(NOT_CSV_MESSAGE);
    expect(checkSelectedFile({ name: "SALES.CSV", size: 10 })).toBeNull();
  });
});

describe("対象月の表示", () => {
  it("YYYY-MM を「年月」にする。月の先頭の 0 は付けない", () => {
    expect(formatMonthLabel("2025-09")).toBe("2025年9月");
    expect(formatMonthLabel("2025-11")).toBe("2025年11月");
  });

  it("形が違う値はそのまま返し、一覧は「、」でつなぐ", () => {
    expect(formatMonthLabel("abc")).toBe("abc");
    expect(formatMonthList(["2025-09", "2025-11"])).toBe("2025年9月、2025年11月");
  });
});

describe("skippedFileName（スキップ行CSVの保存名）", () => {
  it("元の名前の .csv を外して「_スキップ行.csv」を付ける", () => {
    expect(skippedFileName("sample-sales.csv")).toBe("sample-sales_スキップ行.csv");
  });

  it("ファイル名に使えない文字は除き、空になったら「売上」にする", () => {
    expect(skippedFileName('a/b:c*.csv')).toBe("abc_スキップ行.csv");
    expect(skippedFileName("")).toBe("売上_スキップ行.csv");
  });
});
