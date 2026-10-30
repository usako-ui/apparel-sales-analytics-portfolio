// デモ版の基本の画面：取り込み・キーなしの状態・保存先がメモリになった時の表示・スマホ幅
import { expect, test } from "@playwright/test";
import {
  clearKeyButton,
  DUMMY_KEY,
  enterKeyAndGenerate,
  generateButton,
  horizontalOverflow,
  keyField,
  loadSampleData,
  mockGemini,
  respondError,
  respondSuccess,
  type Responder,
  STORE_KEY,
  SUCCESS_SUMMARY,
} from "./support";

test.describe("デモ版の基本", () => {
  test("ダミーCSVを取り込むと、KPI・グラフ・AI分析の欄が出る", async ({ page }) => {
    await loadSampleData(page);
    await expect(page.locator(".recharts-bar-rectangle").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "AI分析コメント" })).toBeVisible();
    // 通常は保存できているので、メモリだけの注意は出ない
    await expect(page.getByText("ブラウザに保存できなかったため")).toHaveCount(0);
  });

  test("キーがない間は「分析を生成」を押せず、理由が文で出る", async ({ page }) => {
    await loadSampleData(page);
    await expect(generateButton(page)).toBeDisabled();
    await expect(page.getByText("Gemini API キーを入力すると、「分析を生成」を押せるようになります。")).toBeVisible();
    // キーを消すボタンも、消すものがないので押せない
    await expect(clearKeyButton(page)).toBeDisabled();
    // 入力すると押せるようになり、理由の文は消える
    await keyField(page).fill(DUMMY_KEY);
    await expect(generateButton(page)).toBeEnabled();
    await expect(page.getByText("Gemini API キーを入力すると、「分析を生成」を押せるようになります。")).toHaveCount(0);
  });

  test("キーの入力欄は password で、常時の注意書きとキーの取り方の案内がある", async ({ page }) => {
    await loadSampleData(page);
    await expect(keyField(page)).toHaveAttribute("type", "password");
    await expect(keyField(page)).toHaveAttribute("autocomplete", "off");
    await expect(page.getByText("入力した内容は Google にだけ送られます。")).toBeVisible();
    const link = page.getByRole("link", { name: /aistudio\.google\.com\/apikey/ });
    await expect(link).toHaveAttribute("href", "https://aistudio.google.com/apikey");
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noopener/);
    await expect(link).toHaveAttribute("rel", /noreferrer/);
    // キーの入力は <form> に入れない（パスワード保存の提案を出さないため）
    expect(await page.locator("form").filter({ has: keyField(page) }).count()).toBe(0);
  });

  test("保存先がメモリに切り替わると、「このタブを閉じるまで保存されます」が出て、画面は動き続ける", async ({ page }) => {
    // 売上データの保存だけを「上限超え」で失敗させる（Next.js など他の保存には影響させない）
    await page.addInitScript((storeKey) => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key: string, value: string) {
        if (key === storeKey) throw new DOMException("quota", "QuotaExceededError");
        return original.call(this, key, value);
      };
    }, STORE_KEY);
    await loadSampleData(page);
    await expect(page.getByText("ブラウザに保存できなかったため、このタブを閉じるまで保存されます。")).toBeVisible();
    // メモリ上のデータでダッシュボードは表示される
    await expect(page.locator(".recharts-bar-rectangle").first()).toBeVisible({ timeout: 20_000 });
    // 保存できなかったので、再読み込みするとデータは消える
    await page.reload();
    await expect(page.getByText("売上データがまだありません")).toBeVisible({ timeout: 20_000 });
  });

  test("スマホ幅・PC 幅とも、取り込み後・成功後・失敗後に横ずれしない", async ({ page }) => {
    // 応答は途中で差し替える（最初は失敗、あとで成功）
    let respond: Responder = respondError(429);
    const gemini = await mockGemini(page, (route) => respond(route));
    await loadSampleData(page);
    expect(await horizontalOverflow(page), "取り込み後").toBeLessThanOrEqual(0);

    // 失敗の案内を出した状態
    await enterKeyAndGenerate(page);
    await expect(page.getByText("Gemini の利用回数の上限に達しました。")).toBeVisible({ timeout: 20_000 });
    expect(gemini.length).toBe(1);
    expect(await horizontalOverflow(page), "失敗の案内の表示中").toBeLessThanOrEqual(0);

    // 成功してコメントが出た状態（同じキーが保持されているので、入力せずに押せる）
    respond = respondSuccess();
    await generateButton(page).click();
    await expect(page.getByText(SUCCESS_SUMMARY)).toBeVisible({ timeout: 20_000 });
    expect(await horizontalOverflow(page), "コメントの表示中").toBeLessThanOrEqual(0);
  });
});
