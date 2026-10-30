// ログイン・強制パスワード変更・停止中・メニューの出し分けの画面確認（実際の検証用 Supabase につなぐ）
// 状態を変える確認は、このテスト専用の一時アカウント（@example.com・テスト後に削除）で行う
import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import {
  adminEmail,
  adminPassword,
  createTempUser,
  deleteTempUser,
  hasEnv,
  loginAs,
  serviceClient,
} from "./support";

// PC は「パスワード変更」、スマホの下のタブは「アカウント」
const accountLink = /パスワード変更|アカウント/;

test.describe("ログイン（検証用 Supabase）", () => {
  test.skip(!hasEnv, ".env.local がないため未実施");
  // pc・sp の2つのプロジェクトで同じ一時アカウントを作らないよう、1つずつ順に実行する
  test.describe.configure({ mode: "serial" });

  test("管理者でログイン → ダッシュボード → ログアウトでログイン画面へ", async ({ page }) => {
    await loginAs(page, adminEmail!, adminPassword!);

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "ダッシュボード", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: accountLink })).toBeVisible();
    // 管理者にはメニューの「管理者」が出る
    await expect(page.getByRole("link", { name: "管理者" })).toBeVisible();

    // ログアウトは、PC は左のメニュー、スマホは「アカウント」タブで開く画面の下にある
    await page.getByRole("link", { name: accountLink }).click();
    await expect(page).toHaveURL(/\/password$/);
    await page.getByRole("button", { name: "ログアウト" }).click();
    await expect(page).toHaveURL(/\/login$/);

    // ログアウト後は保護された URL を開けない
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("パスワードを間違えるとエラーが出て、ログイン画面のまま", async ({ page }) => {
    await loginAs(page, adminEmail!, "wrong-password-for-test");
    // Next.js 自身の通知用 role="alert" と区別するため、main の中だけを見る
    await expect(page.locator("main").getByRole("alert")).toContainText("メールアドレスまたはパスワードが正しくありません");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("休職中のアカウントはログインできない", async ({ page }) => {
    const user = await createTempUser({ status: "leave" });
    try {
      await loginAs(page, user.email, user.password);
      await expect(page.locator("main").getByRole("alert")).toHaveText("アカウントが停止されています。管理者に連絡してください");

      // サインアウトされているので、保護された URL はログイン画面に戻る
      await page.goto("/");
      await expect(page).toHaveURL(/\/login$/);
    } finally {
      await deleteTempUser(user.id);
    }
  });

  test("ログイン中に休職にされると、次の操作でログイン画面へ戻り案内が出る", async ({ page }) => {
    const user = await createTempUser({});
    try {
      await loginAs(page, user.email, user.password);
      await expect(page.getByRole("heading", { name: "ダッシュボード", level: 1 })).toBeVisible();

      await serviceClient().from("profiles").update({ status: "leave" }).eq("user_id", user.id);

      await page.goto("/password");
      await expect(page).toHaveURL(/\/login\?error=suspended$/);
      await expect(page.locator("main").getByRole("alert")).toHaveText("アカウントが停止されています。管理者に連絡してください");
    } finally {
      await deleteTempUser(user.id);
    }
  });

  for (const path of ["/", "/admin"]) {
    test(`ログイン中に休職にされると、${path} を開いてもログイン画面へ戻り案内が出る`, async ({ page }) => {
      const user = await createTempUser({ role: "admin" });
      try {
        await loginAs(page, user.email, user.password);
        await expect(page.getByRole("heading", { name: "ダッシュボード", level: 1 })).toBeVisible();

        await serviceClient().from("profiles").update({ status: "leave" }).eq("user_id", user.id);

        await page.goto(path);
        await expect(page).toHaveURL(/\/login\?error=suspended$/);
        await expect(page.locator("main").getByRole("alert")).toHaveText("アカウントが停止されています。管理者に連絡してください");
      } finally {
        await deleteTempUser(user.id);
      }
    });
  }

  test("ログイン済みで有効な人が /login を開くと / へ移り、停止中の人は移らず案内が出る", async ({ page }) => {
    const active = await createTempUser({});
    const mustChange = await createTempUser({ mustChangePassword: true });
    const suspended = await createTempUser({});
    try {
      // 有効な人 → /
      await loginAs(page, active.email, active.password);
      await expect(page.getByRole("heading", { name: "ダッシュボード", level: 1 })).toBeVisible();
      await page.goto("/login");
      await expect(page).toHaveURL(/\/$/);

      // 一時パスワードのままの人 → /password
      await page.context().clearCookies();
      await loginAs(page, mustChange.email, mustChange.password);
      await expect(page).toHaveURL(/\/password$/);
      await page.goto("/login");
      await expect(page).toHaveURL(/\/password$/);

      // 停止中の人（ログイン済みのまま休職にされた）→ /login にとどまり、案内が出る
      await page.context().clearCookies();
      await loginAs(page, suspended.email, suspended.password);
      await expect(page.getByRole("heading", { name: "ダッシュボード", level: 1 })).toBeVisible();
      await serviceClient().from("profiles").update({ status: "leave" }).eq("user_id", suspended.id);
      await page.goto("/login");
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.locator("main").getByRole("alert")).toHaveText("アカウントが停止されています。管理者に連絡してください");
    } finally {
      await deleteTempUser(active.id);
      await deleteTempUser(mustChange.id);
      await deleteTempUser(suspended.id);
    }
  });

  test("有効な人が /auth/suspended を開かされても、ログアウトされず / へ移る", async ({ page }) => {
    const user = await createTempUser({});
    try {
      await loginAs(page, user.email, user.password);
      await expect(page.getByRole("heading", { name: "ダッシュボード", level: 1 })).toBeVisible();
      await page.goto("/auth/suspended");
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByRole("heading", { name: "ダッシュボード", level: 1 })).toBeVisible();
    } finally {
      await deleteTempUser(user.id);
    }
  });

  test("管理者がメールアドレスを変更した直後でも、パスワードを変更できる", async ({ page }) => {
    const user = await createTempUser({});
    const newPassword = `${randomBytes(12).toString("hex")}Bb2`;
    const newEmail = `e2e-${randomBytes(8).toString("hex")}@example.com`;
    try {
      await loginAs(page, user.email, user.password);
      await expect(page.getByRole("heading", { name: "ダッシュボード", level: 1 })).toBeVisible();

      // ログイン中に、メールアドレスだけが変わる（ブラウザの JWT は古いメールのまま）
      const { error } = await serviceClient().auth.admin.updateUserById(user.id, { email: newEmail, email_confirm: true });
      expect(error).toBeNull();

      await page.goto("/password");
      await page.getByLabel("現在のパスワード").fill(user.password);
      await page.getByLabel("新しいパスワード", { exact: true }).fill(newPassword);
      await page.getByLabel("新しいパスワード（確認用）").fill(newPassword);
      await page.getByRole("button", { name: "変更する" }).click();
      await expect(page.locator("main").getByText("パスワードを変更しました。")).toBeVisible();
    } finally {
      await deleteTempUser(user.id);
    }
  });

  test("一時パスワードのログインは /password に送られ、変更するまで他の画面は開けない", async ({ page }) => {
    const user = await createTempUser({ mustChangePassword: true });
    const newPassword = `${randomBytes(12).toString("hex")}Bb2`;
    try {
      await loginAs(page, user.email, user.password);
      await expect(page).toHaveURL(/\/password$/);

      // 初回は、メニュー・タブを出さない。欄の名前は「一時パスワード」、押せるのは「ログアウト」
      await expect(page.getByRole("navigation")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "ログアウト" })).toBeVisible();
      await expect(page.getByRole("link", { name: "キャンセル" })).toHaveCount(0);

      // ほかの画面は /password に戻される
      await page.goto("/");
      await expect(page).toHaveURL(/\/password$/);

      // 一時パスワードが違うと変更できない
      await page.getByLabel("一時パスワード").fill("wrong-current-password");
      await page.getByLabel("新しいパスワード", { exact: true }).fill(newPassword);
      await page.getByLabel("新しいパスワード（確認用）").fill(newPassword);
      await page.getByRole("button", { name: "変更する" }).click();
      await expect(page.locator("main").getByRole("alert")).toContainText("現在のパスワードが正しくありません");

      // 正しい一時パスワードなら変更でき、ダッシュボードへ
      await page.getByLabel("一時パスワード").fill(user.password);
      await page.getByLabel("新しいパスワード", { exact: true }).fill(newPassword);
      await page.getByLabel("新しいパスワード（確認用）").fill(newPassword);
      await page.getByRole("button", { name: "変更する" }).click();
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByRole("heading", { name: "ダッシュボード", level: 1 })).toBeVisible();

      const { data } = await serviceClient().from("profiles").select("must_change_password").eq("user_id", user.id).single();
      expect(data?.must_change_password).toBe(false);
    } finally {
      await deleteTempUser(user.id);
    }
  });

  test("メニューから開いたパスワード変更は、欄が「現在のパスワード」で、キャンセルでダッシュボードへ戻る", async ({ page }) => {
    const user = await createTempUser({});
    try {
      await loginAs(page, user.email, user.password);
      await page.getByRole("link", { name: accountLink }).click();
      await expect(page).toHaveURL(/\/password$/);
      await expect(page.getByLabel("現在のパスワード")).toBeVisible();
      await page.getByRole("link", { name: "キャンセル" }).click();
      await expect(page).toHaveURL(/\/$/);
    } finally {
      await deleteTempUser(user.id);
    }
  });

  test("操作者には「管理者」が出ず、/admin を直接開くとダッシュボードへ戻る", async ({ page }) => {
    const user = await createTempUser({ role: "operator" });
    try {
      await loginAs(page, user.email, user.password);
      await expect(page.getByRole("heading", { name: "ダッシュボード", level: 1 })).toBeVisible();
      await expect(page.getByRole("link", { name: accountLink })).toBeVisible();
      await expect(page.getByRole("link", { name: "管理者" })).toHaveCount(0);

      await page.goto("/admin");
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByRole("heading", { name: "ダッシュボード", level: 1 })).toBeVisible();
    } finally {
      await deleteTempUser(user.id);
    }
  });

  test("管理者画面：自分の行には、再発行・状態・ロールの変更が出ない", async ({ page }) => {
    await loginAs(page, adminEmail!, adminPassword!);
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "管理者", level: 1 })).toBeVisible();

    // 自分の行（「（あなた）」付き）の操作を開く
    const self = page.locator("tr, li").filter({ hasText: "（あなた）" }).filter({ has: page.getByRole("button", { name: /さんの操作/ }) });
    await self.getByRole("button", { name: /さんの操作/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "名前・メールアドレスを編集" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "ロールを変更" })).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "状態を変更" })).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "一時パスワードを再発行" })).toHaveCount(0);
  });

  test("管理者画面：メンバー追加 → 一時パスワードが1回だけ表示され、閉じると消える", async ({ page }) => {
    const email = `e2e-add-${randomBytes(6).toString("hex")}@example.com`;
    await loginAs(page, adminEmail!, adminPassword!);
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/admin");
    try {
      await page.getByRole("button", { name: "メンバー追加" }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("名前").fill(`画面確認の追加メンバー-${email.slice(8, 14)}`);
      await dialog.getByLabel("メールアドレス").fill(email);
      await dialog.getByRole("button", { name: "追加する" }).click();

      const password = dialog.getByTestId("temporary-password");
      await expect(password).toBeVisible();
      await expect(password).toHaveText(/^\S{16}$/);
      await expect(dialog.getByText("この画面を閉じると二度と表示されません")).toBeVisible();

      await dialog.getByRole("button", { name: "閉じる", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      // 閉じたら、値は画面のどこにも残らない
      await expect(page.getByTestId("temporary-password")).toHaveCount(0);
      await expect(page.getByText(`画面確認の追加メンバー-${email.slice(8, 14)}`).filter({ visible: true })).toBeVisible();
    } finally {
      const client = serviceClient();
      const { data } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const created = data?.users.find((u) => u.email === email);
      if (created) await client.auth.admin.deleteUser(created.id);
    }
  });
});
