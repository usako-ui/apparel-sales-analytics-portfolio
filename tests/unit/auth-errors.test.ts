import { describe, expect, it } from "vitest";
import { RETRY_LATER_MESSAGE, isCredentialError } from "@/lib/auth/errors";

describe("isCredentialError（入力の違いか、時間をおけば直るエラーか）", () => {
  it("400・422 は入力の違い", () => {
    expect(isCredentialError({ status: 400 })).toBe(true);
    expect(isCredentialError({ status: 422 })).toBe(true);
  });

  it("429（ログインの上限）・500 系・status なしは入力の違いではない", () => {
    expect(isCredentialError({ status: 429 })).toBe(false);
    expect(isCredentialError({ status: 500 })).toBe(false);
    expect(isCredentialError({ status: 503 })).toBe(false);
    expect(isCredentialError({ status: 0 })).toBe(false);
    expect(isCredentialError({})).toBe(false);
    expect(isCredentialError({ status: null })).toBe(false);
  });

  it("案内の文は『しばらくしてから、もう一度お試しください。』", () => {
    expect(RETRY_LATER_MESSAGE).toBe("しばらくしてから、もう一度お試しください。");
  });
});
