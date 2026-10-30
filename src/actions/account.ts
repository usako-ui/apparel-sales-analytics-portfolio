"use server";

// ログイン・ログアウト・パスワード変更の Server Action
// メッセージは「何が起きたか → どうすればよいか」。エラーの詳細・キー・パスワードは画面にもログにも出さない
import { redirect } from "next/navigation";
import { z } from "zod";
import { SUSPENDED_MESSAGE } from "@/lib/auth/access";
import { resolveAccount } from "@/lib/auth/account";
import { RETRY_LATER_MESSAGE, isCredentialError } from "@/lib/auth/errors";
import { requireMember } from "@/lib/auth/guard";
import { clearMustChangePassword, recordLastLogin } from "@/lib/auth/profile-writes";
import { createClient, createStatelessClient } from "@/lib/supabase/server";

export type FormState = { error?: string; message?: string } | undefined;

const loginSchema = z.object({
  email: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(200),
});

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) {
    return { error: "メールアドレスとパスワードを入力してください。" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // 400 系はメールかパスワードの違い。どちらが違うかは教えない（アカウントの存在を推測されないため）
    return {
      error: isCredentialError(error)
        ? "メールアドレスまたはパスワードが正しくありません。確認してから、もう一度入力してください。"
        : "ログインできませんでした。しばらくしてから、もう一度お試しください。",
    };
  }

  // 認証が通った後に、アカウントの状態を確かめる（休職・退職・行なしは停止中）
  const result = await resolveAccount(supabase);
  if (result.status !== "ok") {
    await supabase.auth.signOut({ scope: "local" });
    return {
      error:
        result.status === "suspended"
          ? SUSPENDED_MESSAGE
          : "ログインできませんでした。しばらくしてから、もう一度お試しください。",
    };
  }

  await recordLastLogin(result.account.userId);

  // 一時パスワードのままなら、パスワード変更画面へ
  redirect(result.account.mustChangePassword ? "/password" : "/");
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(8).max(72),
  confirmPassword: z.string(),
});

export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  // 一時パスワードのままでも通す（このパスワード変更の処理だけ）。停止中・未ログインはここで止まる
  const member = await requireMember({ onPasswordPage: true });

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    const currentEmpty = !formData.get("currentPassword");
    return {
      error: currentEmpty
        ? "現在のパスワードを入力してください。"
        : "新しいパスワードは8文字以上72文字以内で入力してください。",
    };
  }
  const { currentPassword, newPassword, confirmPassword } = parsed.data;

  if (newPassword !== confirmPassword) {
    return { error: "新しいパスワードと確認用の入力が一致しません。同じものを入力してください。" };
  }
  if (newPassword === currentPassword) {
    return { error: "現在と同じパスワードは使えません。別のパスワードを入力してください。" };
  }

  // 現在のパスワードを確かめる（ログイン中のセッションに影響しない別クライアントで）
  // メールアドレスは getUser() で最新のものを取る（JWT の中のメールは、管理者がメールを変更した直後は古いため）
  const { data: userData, error: userError } = await member.supabase.auth.getUser();
  const currentEmail = userData?.user?.email;
  if (userError || !currentEmail) {
    return { error: "パスワードを変更できませんでした。いったんログアウトして、もう一度ログインしてください。" };
  }
  const verifier = createStatelessClient();
  const { error: verifyError } = await verifier.auth.signInWithPassword({
    email: currentEmail,
    password: currentPassword,
  });
  if (verifyError) {
    // 400 系だけが「パスワードの違い」。429（ログインの上限）などは入力のせいではない
    return {
      error: isCredentialError(verifyError)
        ? "現在のパスワードが正しくありません。確認してから、もう一度入力してください。"
        : `パスワードを変更できませんでした。${RETRY_LATER_MESSAGE}`,
    };
  }

  const { error: updateError } = await member.supabase.auth.updateUser({ password: newPassword });
  if (updateError) {
    return {
      error: isCredentialError(updateError)
        ? "パスワードを変更できませんでした。別のパスワードで、もう一度お試しください。"
        : `パスワードを変更できませんでした。${RETRY_LATER_MESSAGE}`,
    };
  }

  // 一時パスワードの印を外す（本人には profiles の update を許していないため service role で行う）
  if (member.mustChangePassword) {
    const cleared = await clearMustChangePassword(member.userId);
    if (!cleared) {
      return {
        error:
          "パスワードは変更しましたが、設定の更新に失敗しました。新しいパスワードを現在のパスワードとして、もう一度変更してください。",
      };
    }
    redirect("/");
  }

  return { message: "パスワードを変更しました。" };
}
