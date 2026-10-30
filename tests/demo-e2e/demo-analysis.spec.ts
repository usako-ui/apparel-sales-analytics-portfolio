// AI 分析の生成（Gemini への通信はモック）：成功の表示と、失敗ごとの日本語の案内
import { expect, test, type Page } from "@playwright/test";
import {
  enterKeyAndGenerate,
  generateButton,
  keyField,
  loadSampleData,
  mockGemini,
  respondError,
  respondNetworkFailure,
  respondSuccess,
  SUCCESS_SUMMARY,
  successResult,
  DUMMY_KEY,
} from "./support";

// 月の選び欄（aria-label「表示する月」）と、いま選んでいない月を返す。見つからなければ失敗させる（skip しない）
async function pickOtherMonth(page: Page) {
  const monthSelect = page.locator('select[aria-label="表示する月"]');
  await expect(monthSelect).toHaveCount(1);
  const current = await monthSelect.inputValue();
  const values = await monthSelect.locator("option").evaluateAll((els) => els.map((el) => (el as HTMLOptionElement).value));
  const other = values.find((value) => value !== current);
  expect(other, "別の月の選択肢があること").toBeTruthy();
  return { monthSelect, current, other: other as string };
}

test.describe("AI 分析の生成（モック）", () => {
  test("成功：コメントが出て、成功の案内が出る。Gemini へは1回だけ送る", async ({ page }) => {
    const gemini = await mockGemini(page, respondSuccess());
    await loadSampleData(page);
    await enterKeyAndGenerate(page);

    await expect(page.getByText("分析を生成しました。")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(SUCCESS_SUMMARY)).toBeVisible();
    for (const text of successResult.highlights) await expect(page.getByText(text)).toBeVisible();
    for (const text of successResult.concerns) await expect(page.getByText(text)).toBeVisible();
    expect(gemini.length).toBe(1);
    expect(gemini[0].method).toBe("POST");
    expect(gemini[0].url).toContain(":generateContent");
    // 入力欄は空に戻り、キーを保持している旨の案内に変わる
    await expect(page.getByText("キーはこの画面を開いている間だけ保持しています。")).toBeVisible();
    await expect(generateButton(page)).toBeEnabled();
  });

  test("成功した結果は、月を切り替えて戻っても残る", async ({ page }) => {
    await mockGemini(page, respondSuccess());
    await loadSampleData(page);
    await enterKeyAndGenerate(page);
    await expect(page.getByText(SUCCESS_SUMMARY)).toBeVisible({ timeout: 20_000 });

    // 別の月へ（月の選び欄の選択肢から、いま選んでいない月を選ぶ）
    const { monthSelect, current, other } = await pickOtherMonth(page);
    await monthSelect.selectOption(other);
    await expect(page.getByText(SUCCESS_SUMMARY)).toHaveCount(0);
    await monthSelect.selectOption(current);
    await expect(page.getByText(SUCCESS_SUMMARY)).toBeVisible();
  });

  test("生成中に月を切り替えても、別の月では押せない（Google への通信は1件だけ）", async ({ page }) => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const gemini = await mockGemini(page, async (route) => {
      await gate; // 応答を遅らせる
      await respondSuccess()(route);
    });
    await loadSampleData(page);
    await enterKeyAndGenerate(page);
    await expect.poll(() => gemini.length, { timeout: 20_000 }).toBe(1);

    const { monthSelect, current, other } = await pickOtherMonth(page);
    await monthSelect.selectOption(other);
    await expect(monthSelect).toHaveValue(other);

    // 別の月では押せず、理由が文で出る。押そうとしても通信は増えない
    await expect(generateButton(page)).toBeDisabled();
    await expect(page.getByText("別の月の分析を生成しています。")).toBeVisible();
    await generateButton(page).click({ force: true, timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(500);
    expect(gemini.length).toBe(1);

    // 生成が終わると、押せるようになり、元の月にコメントが残る。通信は1件のまま
    release();
    await expect(generateButton(page)).toBeEnabled({ timeout: 20_000 });
    await expect(page.getByText("別の月の分析を生成しています。")).toHaveCount(0);
    await monthSelect.selectOption(current);
    await expect(page.getByText(SUCCESS_SUMMARY)).toBeVisible();
    expect(gemini.length).toBe(1);
  });

  test("入力途中のキーは、月を切り替えても消えない（画面の文字に出ない）", async ({ page }) => {
    await mockGemini(page, respondSuccess());
    await loadSampleData(page);
    await keyField(page).fill(DUMMY_KEY);

    const { monthSelect, other } = await pickOtherMonth(page);
    await monthSelect.selectOption(other);
    await expect(monthSelect).toHaveValue(other);
    await expect(keyField(page)).toHaveValue(DUMMY_KEY);
    // 表示テキストにキーが出ていないこと（input の value は表示テキストに含まれない。入力欄の値は上の toHaveValue で確認済み）
    await expect(page.locator("body")).not.toContainText(DUMMY_KEY);
  });

  test("生成中に別の月へ移って失敗しても、元の月に戻ると失敗の案内が出る", async ({ page }) => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const gemini = await mockGemini(page, async (route) => {
      await gate; // 応答を遅らせる
      await respondError(500)(route);
    });
    await loadSampleData(page);
    await enterKeyAndGenerate(page);
    await expect.poll(() => gemini.length, { timeout: 20_000 }).toBe(1);

    const { monthSelect, current, other } = await pickOtherMonth(page);
    await monthSelect.selectOption(other);
    await expect(monthSelect).toHaveValue(other);

    // 失敗させる。別の月の画面には、元の月の失敗の案内は出ない
    const failureText = "Gemini 側で一時的な問題が起きているようです。";
    release();
    await expect(generateButton(page)).toBeEnabled({ timeout: 20_000 });
    await expect(page.getByText(failureText)).toHaveCount(0);

    // 元の月に戻ると、失敗の案内が出る。原文・キーは出ない・再試行しない
    await monthSelect.selectOption(current);
    await expect(monthSelect).toHaveValue(current);
    await expect(page.getByText(failureText)).toBeVisible();
    await expect(page.locator("body")).not.toContainText("GOOGLE-RAW-ERROR-MESSAGE");
    await expect(page.locator("body")).not.toContainText(DUMMY_KEY);
    expect(gemini.length).toBe(1);
  });

  const failures = [
    { name: "400（キーが違う）", responder: respondError(400), message: "キーが正しくないようです。Google AI Studio で作ったキーを、もう一度入力してください。" },
    { name: "403（キーが使えない）", responder: respondError(403), message: "キーが正しくないようです。" },
    { name: "429（回数の上限）", responder: respondError(429), message: "Gemini の利用回数の上限に達しました。しばらく待ってから、もう一度お試しください。" },
    { name: "500（Google 側の問題）", responder: respondError(500), message: "Gemini 側で一時的な問題が起きているようです。時間をおいて、もう一度お試しください。" },
    { name: "通信の失敗", responder: respondNetworkFailure, message: "通信に失敗しました。接続を確かめて、もう一度お試しください。" },
  ] as const;

  for (const failure of failures) {
    test(`失敗：${failure.name} → 日本語の案内（原文・キーは出さない・再試行しない）`, async ({ page }) => {
      const gemini = await mockGemini(page, failure.responder);
      await loadSampleData(page);
      await enterKeyAndGenerate(page);

      await expect(page.getByText(failure.message)).toBeVisible({ timeout: 20_000 });
      // API の失敗は再試行しない（無料枠を使い切らない）
      expect(gemini.length).toBe(1);
      // Google の返答の原文・状態コードの名前・入力したキーは画面に出ない
      const bodyText = await page.locator("body").innerText();
      expect(bodyText).not.toContain("GOOGLE-RAW-ERROR-MESSAGE");
      expect(bodyText).not.toContain("ERROR_STATUS");
      expect(bodyText).not.toContain(DUMMY_KEY);
      // コメントは出ず、もう一度押せる（キーは保持されている）
      await expect(page.getByText(SUCCESS_SUMMARY)).toHaveCount(0);
      await expect(generateButton(page)).toBeEnabled();
    });
  }

  test("型に合わない応答が3回続くと、本番と同じ文を出す（3回まで再試行）", async ({ page }) => {
    const gemini = await mockGemini(page, respondSuccess('{"summary":"足りない項目がある応答"}'));
    await loadSampleData(page);
    await enterKeyAndGenerate(page);

    await expect(page.getByText("AI分析を生成できませんでした。時間をおいて、もう一度生成してください。")).toBeVisible({
      timeout: 20_000,
    });
    expect(gemini.length).toBe(3);
  });

  test("失敗のあとに押し直して成功すると、案内が消えてコメントが出る", async ({ page }) => {
    let succeed = false;
    await mockGemini(page, (route) => (succeed ? respondSuccess()(route) : respondError(429)(route)));
    await loadSampleData(page);
    await enterKeyAndGenerate(page);
    await expect(page.getByText("Gemini の利用回数の上限に達しました。")).toBeVisible({ timeout: 20_000 });

    succeed = true;
    await generateButton(page).click();
    await expect(page.getByText(SUCCESS_SUMMARY)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Gemini の利用回数の上限に達しました。")).toHaveCount(0);
  });
});
