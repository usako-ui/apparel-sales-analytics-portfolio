# AGENTS.md｜次にこのリポジトリを触る AI 向けの引き継ぎ

売上 CSV から月次レポート（3大 KPI・グラフ・AI 分析コメント）を作る Web アプリです。
このリポジトリを変更する前に、特に「2. 触ると壊れる所」と「3. 変更前に読む設計判断」を読んでください。事実は実コードで確認した範囲です。確認できていないことは「未確認」と書いています。

## 1. このリポジトリの役割

| 場所 | 役割 |
|---|---|
| `src/` | 本番版のアプリ（Next.js の App Router・TypeScript）。ログイン・CSV 取込・ダッシュボード・AI 分析・管理者画面 |
| `supabase/migrations/` | DB の構造と行レベルセキュリティ（RLS）の SQL |
| `tests/` | 単体・権限（RLS）・画面（e2e）のテスト |

- このリポジトリの公開版には、本番のデプロイ設定や本番の Secrets は含まれません

## 2. 触ると壊れる所

- **集計は `src/lib/aggregate` の1か所だけ。** 画面・AI・テストは同じ関数の結果を使います。画面側や別の場所で計算し直さないでください（数字が静かにずれます）
- **正解値テストを通すために、期待値を書き換えない。** 合わないときは実装を疑ってください。分からなければ変更を止めて、人に確認してください
- **日付は `YYYY-MM-DD` の文字列にそろえてから扱う。** `new Date()` に読み取りを任せない（タイムゾーンでずれます）
- **金額は整数（円）。** 割合は表示の直前にだけ小数第1位へ丸めます。内部は分数で持ちます
- **リピート率の定義は `src/lib/aggregate/repeat.ts` の1つの関数にまとめている。** 定義を変えるときは、その関数だけを差し替えます
- 前月比は「計算できない」ときに理由つきの値（`Change` 型）を返します。0 や仮の数字で埋めないでください
- **`src/lib`（集計・CSV・AI の型と照合）を変えたら、CI のすべての job が通ることを確かめる。** 正解値のテストは書き換えない

## 3. 変更前に読む設計判断

### お店単位の RLS とサーバー側の二重確認

- 全テーブルに RLS があり、同じお店で、状態が有効な人の行だけが見えます
- RLS だけに頼らず、ログイン後の画面と Server Action は最初に `src/lib/auth/guard.ts` の `requireMember()`／`requireAdmin()` を呼び、「ログイン中か・有効か・パスワード変更済みか・ロール・同じお店か」を毎回確認します。新しい処理を足すときも、最初にどちらかを呼んでください
- 管理用キー（service role）は `src/lib/supabase/admin.ts`（`server-only`）の1か所だけで使います。クライアントのコードや `NEXT_PUBLIC_` の変数に入れないでください

### AI の出力の型と数字の照合

- AI の出力は Zod の型で検証してから保存します（`src/lib/analysis/schema.ts`）
- 文中の金額・割合は、送った集計値と自動で照合し、合わなければ警告を保存・表示します（`src/lib/analysis/verify.ts`）
- **AI に送るのは集計値だけです。** `customer_id` や明細の行は送りません。送る内容を組み立てる関数（`src/lib/analysis/input.ts`）のテストで確認しています
- 前月比などが「計算できない」値は、理由つきで「計算できない」と渡し、AI に数字を作らせません
- AI の呼び出しは `src/lib/llm` のラッパーの中に閉じます。切り替えは環境変数 `LLM_PROVIDER`（手動。自動フォールバックはしない）

### 一時パスワード

- 管理者が出す一時パスワードは、画面に1回だけ返します。DB・管理操作の記録・ログ・エラーメッセージに残さないでください

## 4. 守る約束

- キー・トークン・パスワードを、ログ・エラーメッセージ・画面・コミットに出さない。環境変数だけで扱う（名前の一覧は `docs/developer-guide.md` の「5. 環境変数」）
- CI のテストで実際の LLM を呼ばない。固定の応答（モック）を使う。実際の API は人が手動で確認するときだけ
- RLS を弱めない。DB の構造・RLS の変更（`supabase/migrations/`）は、SQL の内容を人に見せて承認を得てから適用する
- 環境変数を足したら `.env.example` と `docs/developer-guide.md` の「5. 環境変数」を同時に更新する
- 本番の認証・権限に関わる変更は、テスト（`npm run test:rls`）で他のお店のデータが0件であることを確かめる

## 5. よく使うコマンド

`package.json` の `scripts` にあるものです。

| コマンド | 内容 |
|---|---|
| `npm run dev` | 本番版の開発サーバー（http://localhost:3000） |
| `npm run build` | 本番版のビルド |
| `npm run lint` | コードの検査 |
| `npm run type-check` | 型の検査 |
| `npm run test` | 単体テスト（AI はモック） |
| `npm run test:rls` | 権限（RLS）テスト（Supabase とテスト用アカウントが必要） |
| `npm run test:e2e` | 画面の流れのテスト（Playwright） |
| `npm run admin:first -- --shop … --email … --name …` | 最初の管理者を作る（本人のターミナルで実行する） |

- Node.js は 24.x、パッケージ管理は npm です
- `seed:test` と `screenshot` もありますが、テスト用のデータやスクリーンショットを作るもので、日常の変更では使いません

## 6. このアプリでやらないこと

Shopify API との自動連携・Slack などへの通知・PDF の自動作成とメール配信・複数店舗や複数チャネル・前年同月比・閲覧専用のログインは、範囲に入れていません。メールを使わないため、パスワードの再設定は管理者による一時パスワードの再発行で行います。範囲外のものを「ついでに」足さないでください。

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
