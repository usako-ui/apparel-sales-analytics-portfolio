# 環境変数一覧

このアプリが使う環境変数の「名前」と「入れ方」の一覧です。**値はこの資料に書きません。**
対象：保守担当。手元での動かし方は[開発者ガイド](developer-guide.md)を見てください。
GitHub Secrets と Vercel の項目は、本番を運用する作業用リポジトリでの設定です（公開リポジトリには本番の Secrets を置きません）。

## 1. 守ること

- 値は、チャット・メール・README・スクリーンショット・Git に書きません。入れる場所は次の3か所だけです
- 「公開可」以外の値が漏れたときは、発行元（Supabase・Google・Anthropic・Vercel）でキーを作り直して入れ替えます
- `.env.local` は Git に入りません。`.env.example` には名前だけが入っています

## 2. どこに入れるか

| 場所 | 使うとき | 入れ方 |
|---|---|---|
| `.env.local`（手元のパソコン） | 開発・テスト | `.env.example` を `.env.local` という名前でコピーし、各行の `=` の右に値を入れる。保存したら開発サーバーを再起動 |
| Vercel の環境変数（本番） | 本番アプリ | Vercel のプロジェクト → Settings → Environment Variables → 名前と値を入れて保存 → 反映のため、GitHub の Actions タブで「Deploy」を手動実行する |
| GitHub Secrets | 自動の公開・停止防止 | GitHub のリポジトリ → Settings → Secrets and variables → Actions → New repository secret → 名前と値を入れて保存 |

OK の目安：本番は、Deploy が緑になり、ログインとダッシュボードが開けること。

## 3. 一覧

### アプリが使うもの

| 変数名 | 用途 | 公開 | 入れる場所 | 値の取り方 |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase の URL | 可 | `.env.local`・Vercel・GitHub Secrets（停止防止が使う） | Supabase のプロジェクト設定の API の画面 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase の公開キー（行ごとのアクセス制限が前提） | 可 | `.env.local`・Vercel・GitHub Secrets（停止防止が使う） | 同上 |
| `SUPABASE_SERVICE_ROLE_KEY` | 管理者画面の処理（メンバー追加・一時パスワードの再発行・状態の変更）・テスト | **不可（絶対に隠す）** | `.env.local`・Vercel | 同上。サーバー側だけで使う。ブラウザ・ログに出さない。漏れると全データが読まれる |
| `LLM_PROVIDER` | AI 分析に使うサービス。`claude` か `gemini`（手動で切り替える。自動では切り替わらない） | 可 | `.env.local`・Vercel | 検証環境は `gemini` |
| `ANTHROPIC_API_KEY` | Claude API（本番用） | **不可** | `.env.local`・Vercel（`claude` を使うときだけ） | Anthropic のコンソールで発行 |
| `GEMINI_API_KEY` | Gemini API（検証用） | **不可** | `.env.local`・Vercel（`gemini` を使うときだけ） | Google AI Studio で発行 |
| `GEMINI_MODEL` | Gemini のモデルを切り替える（任意）。`gemini-3.5-flash-lite`（既定）か `gemini-3.8-flash` だけ | 可 | `.env.local`（任意） | 空のままなら既定のモデル。ほかの値は、日本語のエラーで止まる |

Vercel に入れるのは、Supabase の3つ・`LLM_PROVIDER`・使う AI のキーの合計5つです。

### 自動の公開に使うもの（GitHub Secrets だけ）

| 変数名 | 用途 | 公開 | 値の取り方 |
|---|---|---|---|
| `VERCEL_TOKEN` | GitHub Actions から Vercel へ公開する鍵。**有効期限があります** | **不可** | Vercel の Settings → Tokens で作成。更新の手順は[開発者ガイド](developer-guide.md)の「4-1. VERCEL_TOKEN の期限と更新」 |
| `VERCEL_ORG_ID` | Vercel のチーム（またはアカウント）の ID | 不可（公開は避ける） | Vercel のチームの設定画面 |
| `VERCEL_PROJECT_ID` | Vercel のプロジェクトの ID | 不可（公開は避ける） | Vercel のプロジェクトの Settings |

### テストだけに使うもの（`.env.local` だけ・本番には入れない）

| 変数名 | 用途 |
|---|---|
| `TEST_ADMIN_EMAIL`・`TEST_ADMIN_PASSWORD` | 権限テスト・画面確認用の管理者アカウント |
| `TEST_OPERATOR_EMAIL`・`TEST_OPERATOR_PASSWORD` | 同じく操作者アカウント |
| `TEST_OTHER_SHOP_EMAIL`・`TEST_OTHER_SHOP_PASSWORD` | 同じく「別のお店」のアカウント（他のお店のデータが見えないことの確認用） |

テスト用のアカウントは検証用のプロジェクトにだけ作ります。本番のアカウントを使いません。

## 4. 入れ忘れ・入れ間違いのときの症状

| 症状 | 疑うもの |
|---|---|
| ログインできない・画面が真っ白 | `NEXT_PUBLIC_SUPABASE_URL`・`NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| 管理者画面でメンバー追加・再発行が失敗する | `SUPABASE_SERVICE_ROLE_KEY` |
| 「AI分析を生成できませんでした」が続く | `LLM_PROVIDER` と、使う側のキー（`GEMINI_API_KEY`／`ANTHROPIC_API_KEY`）。Gemini の無料枠は1日の回数に上限があります |
| Deploy が赤（`vercel pull` の段階で失敗） | `VERCEL_TOKEN` の期限切れ・権限、`VERCEL_ORG_ID`・`VERCEL_PROJECT_ID` |
| 停止防止（毎日）が赤 | GitHub Secrets の `NEXT_PUBLIC_SUPABASE_URL`・`NEXT_PUBLIC_SUPABASE_ANON_KEY` |
