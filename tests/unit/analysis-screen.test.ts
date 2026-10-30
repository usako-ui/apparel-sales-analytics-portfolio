// AI分析コメントの画面（T-34・35）。表示の部品だけを確かめる（実際の AI・Server Action は呼ばない）
import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { describeWarningField, formatGeneratedAt } from "@/components/analysis/analysis-view";
import { NETWORK_ERROR, requestAnalysis, SIGNED_OUT_ERROR } from "@/components/analysis/analysis-request";
import { AnalysisPanelView, type ShownReport } from "@/components/analysis/AnalysisPanelView";
import { storedReportSchema, type StoredReport } from "@/lib/analysis/schema";

// 見本：テスト用の固定の応答（valid.json）に、数字の照合の結果（警告なし）を足した形
const validJson = JSON.parse(readFileSync(path.resolve(__dirname, "../fixtures/llm/valid.json"), "utf8"));
const okReport: StoredReport = storedReportSchema.parse({ ...validJson, numberWarnings: [] });
const warnedReport: StoredReport = {
  ...okReport,
  numberWarnings: [
    { kind: "amount", text: "約30万円", field: "summary" },
    { kind: "percent", text: "+12.3%", field: "highlights[1]" },
  ],
};
const GENERATED_AT = "2026-10-27T05:05:00.123456+00:00"; // 日本時間 14:05

const shown = (report: StoredReport): ShownReport => ({ report, generatedAt: GENERATED_AT });

function render(overrides: Partial<Parameters<typeof AnalysisPanelView>[0]> = {}) {
  return renderToStaticMarkup(
    createElement(AnalysisPanelView, {
      monthLabel: "2025年11月",
      latest: shown(okReport),
      pending: false,
      errorMessage: null,
      signedOut: false,
      justGenerated: false,
      onGenerate: () => {},
      ...overrides,
    }),
  );
}

const generateButton = (html: string) => /<button[^>]*>[\s\S]*?<\/button>/.exec(html)?.[0] ?? "";
// class の中の "disabled:opacity-60" と区別するため、属性の disabled だけを見る
const isDisabled = (button: string) => /\sdisabled(=|>|\s)/.test(button);

describe("AI分析コメント（正常）", () => {
  const html = render();

  it("まとめ・注目点3・気になる点2・打ち手を出す", () => {
    expect(html).toContain(okReport.summary);
    for (const text of [...okReport.highlights, ...okReport.concerns]) expect(html).toContain(text);
    for (const item of okReport.actions) expect(html).toContain(item.action);
    expect(html.match(/<li[ >]/g)).toHaveLength(3 + 2 + okReport.actions.length);
  });

  it("「AI生成・要確認」と、生成した日時（日本時間）を必ず出す", () => {
    expect(html).toContain("AI生成・要確認");
    expect(html).toContain("2026年10月27日 14:05");
  });

  it("優先度は色だけでなく文字（高・中・低）でも伝える", () => {
    expect(html).toContain("優先度 高");
    expect(html).toContain("優先度 中");
    const withLow = render({ latest: shown({ ...okReport, actions: [{ priority: "low", action: "在庫を見直す" }] }) });
    expect(withLow).toContain("優先度 低");
  });

  it("警告がなければ「数字を確認してください」は出さない", () => {
    expect(html).not.toContain("数字を確認してください");
  });

  it("「分析を生成」ボタンは押せる", () => {
    expect(generateButton(html)).toContain("分析を生成");
    expect(isDisabled(generateButton(html))).toBe(false);
  });
});

describe("AI分析コメント（数字の警告あり）", () => {
  const html = render({ latest: shown(warnedReport) });

  it("「数字を確認してください」と、一致しなかった数値と場所を出す", () => {
    expect(html).toContain("数字を確認してください");
    expect(html).toContain("約30万円");
    expect(html).toContain("（まとめ）");
    expect(html).toContain("+12.3%");
    expect(html).toContain("（注目点2）");
  });

  it("コメント自体は表示したまま、「AI生成・要確認」も残る", () => {
    expect(html).toContain(warnedReport.summary);
    expect(html).toContain(warnedReport.highlights[0]);
    expect(html).toContain("AI生成・要確認");
  });
});

describe("AI分析コメント（まだ生成していない）", () => {
  const html = render({ latest: null });

  it("まだない旨と、生成のしかたを案内する", () => {
    expect(html).toContain("2025年11月の分析コメントは、まだありません");
    expect(html).toContain("「分析を生成」を押すと");
    expect(html).not.toContain("AI生成・要確認");
  });

  it("「分析を生成」ボタンは押せる", () => {
    expect(isDisabled(generateButton(html))).toBe(false);
  });
});

describe("AI分析コメント（失敗）", () => {
  const message = "AI分析を生成できませんでした。時間をおいて、もう一度生成してください。";

  it("message をそのまま出し、もう一度生成できる（ボタンは押せる）", () => {
    const html = render({ latest: null, errorMessage: message });
    expect(html).toContain(message);
    expect(html).toContain('role="alert"');
    expect(generateButton(html)).toContain("分析を生成");
    expect(isDisabled(generateButton(html))).toBe(false);
  });

  it("前の分析があれば、失敗しても残す", () => {
    const html = render({ errorMessage: message });
    expect(html).toContain(message);
    expect(html).toContain(okReport.summary);
  });

  it("ログイン切れの時だけ、ログイン画面へのリンクを出す", () => {
    expect(render({ errorMessage: SIGNED_OUT_ERROR, signedOut: true })).toContain('href="/login"');
    expect(render({ errorMessage: message })).not.toContain('href="/login"');
  });
});

describe("AI分析コメント（処理中・成功）", () => {
  it("処理中はボタンを押せなくし、処理中の表示を出す（二重押しで API を呼ばない）", () => {
    const html = render({ latest: null, pending: true });
    expect(isDisabled(generateButton(html))).toBe(true);
    expect(generateButton(html)).toContain("生成中…");
    expect(html).toContain('role="status"');
    expect(html).toContain("2025年11月の売上を分析しています");
    expect(html).not.toContain("まだありません");
  });

  it("成功したら、確認を促す知らせを出す", () => {
    expect(render({ justGenerated: true })).toContain("分析を生成しました");
    expect(render({ justGenerated: true, pending: true })).not.toContain("分析を生成しました");
  });
});

describe("AI の文は文字として表示する（HTML として解釈しない）", () => {
  it("タグを含む文も、そのまま文字で出る", () => {
    const html = render({ latest: shown({ ...okReport, summary: "<script>alert(1)</script>" }) });
    expect(html).not.toContain("<script>alert(1)");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("requestAnalysis（生成の実行と、失敗の案内）", () => {
  const never = () => Promise.resolve(false);

  it("成功なら ok。選んでいる月を渡して1回だけ呼ぶ", async () => {
    const action = vi.fn().mockResolvedValue({ ok: true });
    expect(await requestAnalysis("2025-11", action, never)).toEqual({ ok: true });
    expect(action).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledWith("2025-11");
  });

  it("サーバーの失敗は message をそのまま返す", async () => {
    const action = vi.fn().mockResolvedValue({ ok: false, message: "時間をおいて、もう一度生成してください。" });
    expect(await requestAnalysis("2025-11", action, never)).toEqual({
      ok: false,
      message: "時間をおいて、もう一度生成してください。",
      signedOut: false,
    });
  });

  it("通信の失敗（例外）は、日本語の案内にする", async () => {
    const action = vi.fn().mockRejectedValue(new Error("fetch failed: internal-detail"));
    const outcome = await requestAnalysis("2025-11", action, never);
    expect(outcome).toEqual({ ok: false, message: NETWORK_ERROR, signedOut: false });
    expect(JSON.stringify(outcome)).not.toContain("internal-detail");
  });

  it("例外の原因がログイン切れなら、ログインし直す案内にする", async () => {
    const action = vi.fn().mockRejectedValue(new Error("unexpected response"));
    expect(await requestAnalysis("2025-11", action, () => Promise.resolve(true))).toEqual({
      ok: false,
      message: SIGNED_OUT_ERROR,
      signedOut: true,
    });
  });
});

describe("表示の小さな関数", () => {
  it("formatGeneratedAt：日本時間で「年月日 時:分」。読めない値は null", () => {
    expect(formatGeneratedAt("2026-10-27T05:05:00+00:00")).toBe("2026年10月27日 14:05");
    expect(formatGeneratedAt("2026-12-31T16:30:00Z")).toBe("2027年1月1日 01:30");
    expect(formatGeneratedAt("not-a-date")).toBeNull();
  });

  it("describeWarningField：場所を日本語にする。知らない形は null", () => {
    expect(describeWarningField("summary")).toBe("まとめ");
    expect(describeWarningField("highlights[0]")).toBe("注目点1");
    expect(describeWarningField("concerns[1]")).toBe("気になる点2");
    expect(describeWarningField("actions[2]")).toBe("打ち手3");
    expect(describeWarningField("other")).toBeNull();
  });
});
