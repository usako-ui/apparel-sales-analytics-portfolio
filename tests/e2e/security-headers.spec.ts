import { expect, test } from "@playwright/test";

// クリックジャッキング対策のヘッダーが全ページに付いていること（ログイン不要）
test("ログイン画面の応答に、他サイトへの埋め込みを禁止するヘッダーが付く", async ({ request }) => {
  const response = await request.get("/login");
  const headers = response.headers();

  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
});
