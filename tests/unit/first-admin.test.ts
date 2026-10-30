import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createFirstAdmin } from "@/lib/admin/first-admin";

type Options = {
  shops?: { id: string }[];
  admins?: { user_id: string }[];
  users?: { email: string }[];
  profileError?: string;
  deleteError?: string;
};

// Supabase のクライアントの代わり。呼ばれた操作を calls に記録する
function createMock(options: Options = {}) {
  const calls: string[] = [];
  const shopInsert = vi.fn();
  const profileInsert = vi.fn();
  const createUser = vi.fn();
  const deleteUser = vi.fn();

  const selectChain = (rows: unknown[]) => {
    const chain: Record<string, unknown> = {};
    chain.eq = () => chain;
    chain.limit = () => Promise.resolve({ data: rows, error: null });
    return chain;
  };

  const client = {
    from(table: string) {
      if (table === "shops") {
        return {
          select: () => selectChain(options.shops ?? []),
          insert: (row: unknown) => {
            calls.push("shops.insert");
            shopInsert(row);
            return { select: () => ({ single: () => Promise.resolve({ data: { id: "new-shop" }, error: null }) }) };
          },
        };
      }
      return {
        select: () => selectChain(options.admins ?? []),
        insert: (row: unknown) => {
          calls.push("profiles.insert");
          profileInsert(row);
          return Promise.resolve({ error: options.profileError ? { message: options.profileError } : null });
        },
      };
    },
    auth: {
      admin: {
        listUsers: () => Promise.resolve({ data: { users: options.users ?? [] }, error: null }),
        createUser: (arg: unknown) => {
          calls.push("createUser");
          createUser(arg);
          return Promise.resolve({ data: { user: { id: "new-user" } }, error: null });
        },
        deleteUser: (id: string) => {
          calls.push("deleteUser");
          deleteUser(id);
          return Promise.resolve({ error: options.deleteError ? { message: options.deleteError } : null });
        },
      },
    },
  } as unknown as SupabaseClient;

  return { client, calls, shopInsert, profileInsert, createUser, deleteUser };
}

const input = { shopName: "LUMINA", email: "first@example.com", displayName: "最初の管理者" };

describe("createFirstAdmin（最初の管理者の作成）", () => {
  it("有効な管理者がいるお店では、何も作らずに止まり、パスワードを返さない", async () => {
    const m = createMock({ shops: [{ id: "s1" }], admins: [{ user_id: "u1" }] });
    const result = await createFirstAdmin(m.client, input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("admin_exists");
    expect(result).not.toHaveProperty("temporaryPassword");
    expect(m.createUser).not.toHaveBeenCalled();
    expect(m.profileInsert).not.toHaveBeenCalled();
    expect(m.shopInsert).not.toHaveBeenCalled();
  });

  it("新規作成：email_confirm: true で作り、profiles は admin・active・must_change_password=true、パスワードは16文字", async () => {
    const m = createMock({ shops: [{ id: "s1" }] });
    const result = await createFirstAdmin(m.client, input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.temporaryPassword).toHaveLength(16);
    expect(result.shopCreated).toBe(false);
    expect(m.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: "first@example.com", email_confirm: true, password: result.temporaryPassword }),
    );
    expect(m.profileInsert).toHaveBeenCalledWith({
      user_id: "new-user",
      shop_id: "s1",
      display_name: "最初の管理者",
      role: "admin",
      status: "active",
      must_change_password: true,
    });
    // パスワードは profiles・お店のデータに入らない
    expect(JSON.stringify(m.profileInsert.mock.calls)).not.toContain(result.temporaryPassword);
  });

  it("お店がないときは、お店を作ってから管理者を作る", async () => {
    const m = createMock();
    const result = await createFirstAdmin(m.client, input);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.shopCreated).toBe(true);
    expect(m.shopInsert).toHaveBeenCalledWith({ name: "LUMINA" });
    expect(m.calls).toEqual(["shops.insert", "createUser", "profiles.insert"]);
    expect(m.profileInsert).toHaveBeenCalledWith(expect.objectContaining({ shop_id: "new-shop" }));
  });

  it("同じメールのアカウントが既にあるときは止まる（大文字小文字は区別しない）", async () => {
    const m = createMock({ shops: [{ id: "s1" }], users: [{ email: "FIRST@example.com" }] });
    const result = await createFirstAdmin(m.client, input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("email_exists");
    expect(m.createUser).not.toHaveBeenCalled();
    expect(m.shopInsert).not.toHaveBeenCalled();
  });

  it("profiles の登録に失敗したら、作った Auth アカウントを削除する", async () => {
    const m = createMock({ shops: [{ id: "s1" }], profileError: "insert failed" });
    await expect(createFirstAdmin(m.client, input)).rejects.toThrow("insert failed");
    expect(m.deleteUser).toHaveBeenCalledWith("new-user");
  });

  it("エラーメッセージに一時パスワードが含まれない（削除にも失敗した場合も）", async () => {
    const m = createMock({ shops: [{ id: "s1" }], profileError: "insert failed", deleteError: "delete failed" });
    let message = "";
    try {
      await createFirstAdmin(m.client, input);
    } catch (error) {
      message = (error as Error).message;
    }
    const sent = (m.createUser.mock.calls[0][0] as { password: string }).password;
    expect(message).toContain("手動で削除");
    expect(message).not.toContain(sent);
  });

  it.each([
    ["メール形式が不正", { ...input, email: "not-an-email" }],
    ["メールが空", { ...input, email: "  " }],
    ["お店の名前が空", { ...input, shopName: "" }],
    ["表示名が空", { ...input, displayName: "" }],
  ])("不正な入力（%s）は何もせずに止まる", async (_label, bad) => {
    const m = createMock();
    const result = await createFirstAdmin(m.client, bad);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid_input");
    expect(m.calls).toEqual([]);
  });
});
