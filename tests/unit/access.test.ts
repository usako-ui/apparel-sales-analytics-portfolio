import { describe, expect, it } from "vitest";
import { type AccountProfile, decideAccess, parseProfileRows } from "@/lib/auth/access";

// profiles の1行（有効な操作者）。テストごとに一部だけ書き換える
const baseRow = {
  shop_id: "11111111-1111-1111-1111-111111111111",
  display_name: "テスト",
  role: "operator",
  status: "active",
  must_change_password: false,
};

describe("parseProfileRows（状態の判定）", () => {
  it("active・操作者・変更済み → 有効", () => {
    expect(parseProfileRows([baseRow])).toEqual({
      state: "active",
      profile: {
        shopId: baseRow.shop_id,
        displayName: "テスト",
        role: "operator",
        mustChangePassword: false,
      },
    });
  });

  it("active・管理者 → 有効（ロールは admin）", () => {
    const result = parseProfileRows([{ ...baseRow, role: "admin" }]);
    expect(result.state).toBe("active");
    if (result.state === "active") expect(result.profile.role).toBe("admin");
  });

  it("active・must_change_password=true → 有効で、変更が必要の印が付く", () => {
    const result = parseProfileRows([{ ...baseRow, must_change_password: true }]);
    expect(result.state).toBe("active");
    if (result.state === "active") expect(result.profile.mustChangePassword).toBe(true);
  });

  it.each(["leave", "retired"])("status=%s → 停止中", (status) => {
    expect(parseProfileRows([{ ...baseRow, status }])).toEqual({ state: "suspended" });
  });

  it.each([["Active"], ["deleted"], [""], [null], [undefined], [1], [true]])("想定外の status（%s）→ 停止中", (status) => {
    expect(parseProfileRows([{ ...baseRow, status }])).toEqual({ state: "suspended" });
  });

  it.each([[[]], [null], [undefined], [{}], ["x"]])("行がない・配列でない（%j）→ 停止中", (rows) => {
    expect(parseProfileRows(rows)).toEqual({ state: "suspended" });
  });

  it("2行返ってきたら想定外なので停止中", () => {
    expect(parseProfileRows([baseRow, baseRow])).toEqual({ state: "suspended" });
  });

  it.each([
    ["role が想定外", { role: "owner" }],
    ["role が null", { role: null }],
    ["shop_id が null", { shop_id: null }],
    ["shop_id が空", { shop_id: "" }],
    ["must_change_password が文字列", { must_change_password: "false" }],
    ["must_change_password が null", { must_change_password: null }],
    ["display_name が欠けている", { display_name: undefined }],
  ])("active でも値が想定外（%s）→ 停止中", (_label, patch) => {
    expect(parseProfileRows([{ ...baseRow, ...patch }])).toEqual({ state: "suspended" });
  });
});

describe("decideAccess（画面・処理を通してよいか）", () => {
  const profile = (patch: Partial<AccountProfile> = {}): AccountProfile => ({
    shopId: baseRow.shop_id,
    displayName: "テスト",
    role: "operator",
    mustChangePassword: false,
    ...patch,
  });

  it("変更済みの操作者は通常の画面を通る", () => {
    expect(decideAccess(profile())).toBe("allow");
  });

  it("一時パスワードのままだと、通常の画面・処理は /password へ", () => {
    expect(decideAccess(profile({ mustChangePassword: true }))).toBe("changePassword");
  });

  it("一時パスワードのままでも、パスワード変更の画面・処理は通る", () => {
    expect(decideAccess(profile({ mustChangePassword: true }), { onPasswordPage: true })).toBe("allow");
  });

  it("一時パスワードのままの管理者は、管理者の画面も通らない", () => {
    expect(decideAccess(profile({ role: "admin", mustChangePassword: true }), { requireAdmin: true })).toBe(
      "changePassword",
    );
  });

  it("操作者は管理者の画面・処理を通らない", () => {
    expect(decideAccess(profile(), { requireAdmin: true })).toBe("forbidden");
  });

  it("管理者は管理者の画面・処理を通る", () => {
    expect(decideAccess(profile({ role: "admin" }), { requireAdmin: true })).toBe("allow");
  });
});
