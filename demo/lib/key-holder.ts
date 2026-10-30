// Gemini キーの保持（CR-02 手順4）。メモリだけ。localStorage・sessionStorage・URL・Cookie・console に触れない
// 画面を閉じる・再読み込みで消える。入力したキーを画面に再表示しない

export type KeyHolder = {
  set(key: string): void;
  get(): string | null;
  has(): boolean;
  clear(): void;
};

export function createKeyHolder(): KeyHolder {
  let current: string | null = null;
  return {
    set(key) {
      const trimmed = key.trim();
      current = trimmed === "" ? null : trimmed;
    },
    get: () => current,
    has: () => current !== null,
    clear() {
      current = null;
    },
  };
}
