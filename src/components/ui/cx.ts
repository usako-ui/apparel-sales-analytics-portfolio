// クラス名をつなぐ小さな関数（false・空は無視）
export function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}
