// 入口の認可（二重防御のサーバー側）。ログイン後のすべての画面・Server Action が、最初にここを呼ぶ
//   requireMember()：ログイン中・有効・パスワード変更済み（＝同じお店のメンバー）
//   requireAdmin() ：上に加えて管理者
// 理由：確認の漏れを「関数を呼び忘れたか」だけの確認にできる。RLS が効いていても、ここでも止める
// 注意：use cache（private を含む）は使わない。ブラウザに結果が残ると、休職・退職にした直後の
//       次の操作から反映できなくなるため（AC-16・architecture.md 第17項1）
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { type AccessOptions, decideAccess } from "./access";
import { type Account, resolveAccount } from "./account";

export type Member = Account & {
  // ログイン中の人の権限（RLS が効く）の Supabase クライアント。この後のデータ取得に使う
  supabase: SupabaseClient;
};

// 同じリクエストの中（レイアウトとページなど）で何度呼んでも、確認は1回だけ。
// react の cache は1リクエストの間だけ有効で、次のリクエストには残らない
const loadAccount = cache(async () => {
  // リクエストごとの処理だと明示する（JWT の期限確認で現在時刻を使うため。Next.js の事前描画の検証が求める書き方）
  await connection();
  const supabase = await createClient();
  const result = await resolveAccount(supabase);
  return { supabase, result };
});

async function guard(options: AccessOptions): Promise<Member> {
  const { supabase, result } = await loadAccount();

  if (result.status === "signedOut") redirect("/login");
  // 停止中：サインアウトしてログイン画面へ（Cookie を消せるのは Route Handler なのでそこで行う）
  if (result.status === "suspended") redirect("/auth/suspended");

  const decision = decideAccess(result.account, options);
  if (decision === "changePassword") redirect("/password");
  if (decision === "forbidden") redirect("/");

  return { ...result.account, supabase };
}

// options.onPasswordPage は /password の画面・パスワード変更の処理だけで true にする
export async function requireMember(options: { onPasswordPage?: boolean } = {}): Promise<Member> {
  return guard({ onPasswordPage: options.onPasswordPage });
}

export async function requireAdmin(): Promise<Member> {
  return guard({ requireAdmin: true });
}
