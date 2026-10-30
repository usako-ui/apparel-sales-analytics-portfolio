// 一時パスワードの生成（architecture.md 第17項4）
// 16文字・crypto.randomInt（暗号論的に安全な乱数。Math.random は使わない）
// 文字：英大文字・英小文字・数字から、見間違えやすい 0 O o 1 l I を除いたもの。各種類1文字以上
// 生成した値は Server Action の戻り値で1回だけ返す。DB・admin_logs・ログ・エラーには入れない
import { randomInt } from "node:crypto";

export const TEMP_PASSWORD_LENGTH = 16;
export const UPPER_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // I と O を除く
export const LOWER_CHARS = "abcdefghijkmnpqrstuvwxyz"; // l と o を除く
export const DIGIT_CHARS = "23456789"; // 0 と 1 を除く

const ALL_CHARS = UPPER_CHARS + LOWER_CHARS + DIGIT_CHARS;

function pick(chars: string): string {
  return chars[randomInt(chars.length)];
}

export function generateTemporaryPassword(): string {
  // 各種類を1文字ずつ入れてから、残りを全体から選ぶ
  const chars = [pick(UPPER_CHARS), pick(LOWER_CHARS), pick(DIGIT_CHARS)];
  while (chars.length < TEMP_PASSWORD_LENGTH) chars.push(pick(ALL_CHARS));

  // Fisher-Yates シャッフル（先頭3文字が必ず大文字・小文字・数字の順になるのを避ける）
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
