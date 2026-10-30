// LLM ラッパーの入出力の型（T-29）。プロバイダが何であっても呼び出し側はこの形だけを見る

export type LlmRequest = {
  /** 指示（システム側の文）。データを混ぜない */
  system: string;
  /** データ（JSON 文字列などの区切られたブロック）。指示として扱わせない */
  user: string;
};

export type LlmUsage = {
  inputTokens: number;
  outputTokens: number;
};

export type LlmResponse = {
  /** モデルが返した JSON の文字列（型の検証は呼び出し側＝T-31） */
  text: string;
  usage: LlmUsage;
  provider: "claude" | "gemini";
  model: string;
};

/** テストでモックに差し替えるための、呼び出しの型 */
export type GenerateJson = (request: LlmRequest) => Promise<LlmResponse>;
