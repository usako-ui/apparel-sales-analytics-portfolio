// アカウントの状態の判定（純粋な関数。DB・Next.js に触れないので単体テストできる）
// ルール（architecture.md 第17項2）：
//   profiles が「ちょうど1行」で、status が active、ほかの値も想定どおりのときだけ「有効」。
//   0件・行がない・active 以外・想定外の値は、すべて「停止中」（安全な側に倒す）
import { z } from "zod";

export const SUSPENDED_MESSAGE = "アカウントが停止されています。管理者に連絡してください";

export type Role = "admin" | "operator";

export type AccountProfile = {
  shopId: string;
  displayName: string;
  role: Role;
  mustChangePassword: boolean;
};

export type ParsedAccount = { state: "active"; profile: AccountProfile } | { state: "suspended" };

// status は "active" だけを通す（leave・retired・未知の文字列・null はすべて検証に失敗 → 停止中）
const profileRowSchema = z.object({
  shop_id: z.string().min(1),
  display_name: z.string(),
  role: z.enum(["admin", "operator"]),
  status: z.literal("active"),
  must_change_password: z.boolean(),
});

// profiles を本人の権限（RLS）で読んだ結果（行の配列）から、状態を判定する
export function parseProfileRows(rows: unknown): ParsedAccount {
  // RLS で見えない（休職・退職を含む）と0件、行がないときも0件。2件以上も想定外なので停止中
  if (!Array.isArray(rows) || rows.length !== 1) return { state: "suspended" };

  const parsed = profileRowSchema.safeParse(rows[0]);
  if (!parsed.success) return { state: "suspended" };

  return {
    state: "active",
    profile: {
      shopId: parsed.data.shop_id,
      displayName: parsed.data.display_name,
      role: parsed.data.role,
      mustChangePassword: parsed.data.must_change_password,
    },
  };
}

export type AccessOptions = {
  // /password の画面・パスワード変更の処理だけ true にする（一時パスワードのままでも通す）
  onPasswordPage?: boolean;
  // 管理者だけの画面・処理
  requireAdmin?: boolean;
};

export type AccessDecision = "allow" | "changePassword" | "forbidden";

// 有効なアカウントに対して、この画面・処理を通してよいかを決める
export function decideAccess(profile: AccountProfile, options: AccessOptions = {}): AccessDecision {
  // 一時パスワードのままの間は、/password 以外を拒否する（管理者の画面も同じ）
  if (profile.mustChangePassword && !options.onPasswordPage) return "changePassword";
  if (options.requireAdmin && profile.role !== "admin") return "forbidden";
  return "allow";
}
