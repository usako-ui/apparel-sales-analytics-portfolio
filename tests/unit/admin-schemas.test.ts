import { describe, expect, it } from "vitest";
import {
  changeRoleSchema,
  changeStatusSchema,
  createMemberSchema,
  editMemberSchema,
  firstIssueMessage,
  reissueSchema,
} from "@/lib/admin/schemas";

const uuid = "11111111-1111-4111-8111-111111111111";

describe("createMemberSchema", () => {
  it("正しい入力は通り、名前は前後の空白を除き、メールは小文字にそろう", () => {
    const r = createMemberSchema.safeParse({ displayName: "  山田 花子 ", email: " Hanako@Example.COM ", role: "operator" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.displayName).toBe("山田 花子");
      expect(r.data.email).toBe("hanako@example.com");
    }
  });

  it("名前が空・空白だけ・51文字以上は日本語のメッセージで拒否", () => {
    for (const displayName of ["", "   ", "あ".repeat(51)]) {
      const r = createMemberSchema.safeParse({ displayName, email: "a@example.com", role: "admin" });
      expect(r.success).toBe(false);
      if (!r.success) expect(firstIssueMessage(r.error)).toMatch(/名前/);
    }
  });

  it("メールの形式が違うものは拒否", () => {
    for (const email of ["", "abc", "a@", "@example.com", "a b@example.com"]) {
      const r = createMemberSchema.safeParse({ displayName: "山田", email, role: "admin" });
      expect(r.success).toBe(false);
      if (!r.success) expect(firstIssueMessage(r.error)).toMatch(/メールアドレス/);
    }
  });

  it("ロールが admin・operator 以外は拒否", () => {
    const r = createMemberSchema.safeParse({ displayName: "山田", email: "a@example.com", role: "owner" });
    expect(r.success).toBe(false);
    if (!r.success) expect(firstIssueMessage(r.error)).toMatch(/ロール/);
  });

  it("項目が足りない（undefined）でも例外にならず拒否", () => {
    expect(createMemberSchema.safeParse({}).success).toBe(false);
    expect(createMemberSchema.safeParse(null).success).toBe(false);
  });
});

describe("対象の指定・状態・ロール", () => {
  it("targetId が UUID でなければ拒否", () => {
    expect(reissueSchema.safeParse({ targetId: "abc" }).success).toBe(false);
    expect(reissueSchema.safeParse({ targetId: uuid }).success).toBe(true);
  });

  it("状態は active・leave・retired だけ", () => {
    for (const status of ["active", "leave", "retired"]) {
      expect(changeStatusSchema.safeParse({ targetId: uuid, status }).success).toBe(true);
    }
    expect(changeStatusSchema.safeParse({ targetId: uuid, status: "deleted" }).success).toBe(false);
  });

  it("ロールは admin・operator だけ", () => {
    expect(changeRoleSchema.safeParse({ targetId: uuid, role: "admin" }).success).toBe(true);
    expect(changeRoleSchema.safeParse({ targetId: uuid, role: "root" }).success).toBe(false);
  });
});

describe("editMemberSchema", () => {
  it("名前だけ・メールだけでも通る", () => {
    expect(editMemberSchema.safeParse({ targetId: uuid, displayName: "新しい名前" }).success).toBe(true);
    expect(editMemberSchema.safeParse({ targetId: uuid, email: "new@example.com" }).success).toBe(true);
  });

  it("名前もメールも無いときは拒否", () => {
    const r = editMemberSchema.safeParse({ targetId: uuid });
    expect(r.success).toBe(false);
    if (!r.success) expect(firstIssueMessage(r.error)).toMatch(/どちらか/);
  });
});
