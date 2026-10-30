import { expect, test } from "@playwright/test";

// T-06：未ログインで保護された URL を直接開くと、ログイン画面に戻る（AC：URL直打ちの保護）
for (const path of ["/", "/admin", "/upload", "/password"]) {
  test(`未ログインで ${path} を開くとログイン画面に戻る`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
    await expect(page.getByLabel("メールアドレス")).toBeVisible();
  });
}

test("ログイン画面は未ログインで開ける", async ({ page }) => {
  await page.goto("/login");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText("パスワードを忘れた方は管理者に連絡してください")).toBeVisible();
});

test("停止中の案内つきのログイン画面にメッセージが出る", async ({ page }) => {
  await page.goto("/login?error=suspended");
  await expect(page.locator("main").getByRole("alert")).toHaveText("アカウントが停止されています。管理者に連絡してください");
});

// 停止中と確認できた人だけをサインアウトする（ログアウト CSRF の対策）。未ログインは案内なしで /login へ
test("/auth/suspended は未ログインならログイン画面（案内なし）へ戻す", async ({ page }) => {
  await page.goto("/auth/suspended");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
});
