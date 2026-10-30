// LLM まわりのエラー（T-29）。メッセージは日本語で、キーなどの値を含めない

/** 設定の誤り（環境変数がない・値が使えない）。直すのは開発者 */
export class LlmConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmConfigError";
  }
}

/**
 * API 呼び出しの失敗。元のエラーは SDK によってキーや URL を含むことがあるため、
 * メッセージにも cause にも入れない。状態コード（数字）だけ持つ
 */
export class LlmCallError extends Error {
  readonly status: number | null;
  constructor(status: number | null) {
    super("AI分析の呼び出しに失敗しました。時間をおいて、もう一度お試しください。");
    this.name = "LlmCallError";
    this.status = status;
  }
}

/** SDK のエラーから HTTP 状態コードだけを取り出す（なければ null） */
export function statusOf(error: unknown): number | null {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === "number" && Number.isInteger(status)) return status;
  }
  return null;
}
