import { describe, expect, it } from "vitest";
import {
  DIGIT_CHARS,
  LOWER_CHARS,
  TEMP_PASSWORD_LENGTH,
  UPPER_CHARS,
  generateTemporaryPassword,
} from "@/lib/admin/temp-password";

describe("generateTemporaryPassword（一時パスワードの生成）", () => {
  const samples = Array.from({ length: 1000 }, () => generateTemporaryPassword());

  it("1000回生成して、すべて16文字", () => {
    expect(samples.every((p) => p.length === TEMP_PASSWORD_LENGTH && p.length === 16)).toBe(true);
  });

  it("使う文字だけで作られている（英大文字・英小文字・数字）", () => {
    const allowed = new Set(UPPER_CHARS + LOWER_CHARS + DIGIT_CHARS);
    for (const p of samples) {
      for (const c of p) expect(allowed.has(c)).toBe(true);
    }
  });

  it("見間違えやすい文字 0 O o 1 l I が出ない", () => {
    for (const p of samples) expect(p).not.toMatch(/[0Oo1lI]/);
  });

  it("英大文字・英小文字・数字を各1文字以上含む", () => {
    for (const p of samples) {
      expect(p).toMatch(/[A-Z]/);
      expect(p).toMatch(/[a-z]/);
      expect(p).toMatch(/[0-9]/);
    }
  });

  it("毎回違う値になる（1000個がすべて異なる）", () => {
    expect(new Set(samples).size).toBe(1000);
  });
});
