// 想定外のエラーの画面（T-27 No.2）。わざと例外を出す仕組みを本番のコードに入れないため、
// error.tsx のコンポーネントを直接呼び、出る文・ボタン・再読み込みのつなぎを確かめる
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import AppError from "@/app/(app)/error";
import RootError from "@/app/error";
import GlobalError from "@/app/global-error";

const ERROR_DETAIL = "Error: relation profiles failed at /srv/app/account.ts:30 (internal-detail)";

function setup(component: (props: { error: Error & { digest?: string }; retry: () => void }) => ReactElement) {
  const retry = vi.fn();
  const element = component({ error: Object.assign(new Error(ERROR_DETAIL), { digest: "abc123" }), retry });
  return { element, retry, html: renderToStaticMarkup(element) };
}

describe.each([
  ["src/app/error.tsx", RootError],
  ["src/app/(app)/error.tsx", AppError],
  ["src/app/global-error.tsx", GlobalError],
])("%s", (_name, component) => {
  it("日本語で「何が起きたか → どうすればよいか」と、再読み込みのボタンを出す", () => {
    const { html } = setup(component);
    expect(html).toContain("画面を表示できませんでした");
    expect(html).toContain("もう一度読み込んでください");
    expect(html).toContain("管理者に連絡してください");
    expect(html).toMatch(/<button[^>]*>もう一度読み込む<\/button>/);
  });

  it("error.message・スタック・digest は画面に出さない（英語の標準文も出さない）", () => {
    const { html } = setup(component);
    expect(html).not.toContain("internal-detail");
    expect(html).not.toContain("account.ts");
    expect(html).not.toContain("abc123");
    expect(html).not.toMatch(/something went wrong|application error/i);
  });
});

describe("再読み込みのつなぎ", () => {
  it("error.tsx は retry をそのまま画面のボタンに渡す", () => {
    for (const component of [RootError, AppError]) {
      const { element, retry } = setup(component);
      expect((element as ReactElement<{ onRetry: () => void }>).props.onRetry).toBe(retry);
    }
  });

  it("global-error は html・body を自分で持つ（root layout の代わりになるため）", () => {
    const { html } = setup(GlobalError);
    expect(html.startsWith("<html")).toBe(true);
    expect(html).toContain("<body");
  });
});
