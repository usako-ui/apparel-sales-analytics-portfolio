# demo/｜デモ版と紹介ページ（ポートフォリオ用）

このフォルダは、ポートフォリオとして見せるための **デモ版と紹介ページ（LP）** です。**納品物ではありません。** 納品物（本番版）の資料は、リポジトリ直下の [README](../README.md) の「納品物（本番版）」から辿れます。

| 見るもの | URL |
|---|---|
| 紹介ページ（LP） | https://sales-dashboard-lp.vercel.app/ |
| デモ版（ダミーのデータで試せる） | https://sales-dashboard-lp.vercel.app/demo |

## 本番版との違い

| 項目 | 本番版（`src/`） | デモ版（`demo/`） |
|---|---|---|
| ログイン | あり（Supabase Auth） | なし |
| データの保存先 | Supabase（DB） | 閲覧者のブラウザの中だけ（`localStorage`） |
| AI 分析 | サーバーから呼ぶ（Claude／Gemini を環境変数で切り替え） | 閲覧者が自分の Gemini API キーを入れ、ブラウザから直接呼ぶ |
| 分析の履歴 | 保存して見返せる | なし |
| 環境変数 | あり | なし |

## 本番版と共有しているもの

`demo/` は、次の部分を本番版の `src/` から import で使っています。数字を出す関数を1か所のままにするためです。

| 共有している場所 | 役割 |
|---|---|
| `src/lib/aggregate` | 集計（売上・粗利・リピート率など） |
| `src/lib/csv` | CSV の読み取りと検査 |
| `src/lib/analysis` | AI の出力の型と、数字の自動照合 |
| `src/components/dashboard`・`ui` | ダッシュボードの画面部品と共通の部品 |

- これらを変えると、デモ版の型チェック・ビルドも影響を受けます（CI の `demo` ジョブで確認）
- デモ側で必要になった違いは、共有コードに分岐を足さず、`demo/` の中か、省略可能な差し込み口（props）で吸収します

## 手元で動かす

前提：Node.js 24.x。リポジトリ直下で `npm install` を済ませておきます（`demo/` は直下の `node_modules` を使います）。

| コマンド | 内容 |
|---|---|
| `npm run demo:dev` | デモ版・LP の開発サーバー（LP は `/`、デモは `/demo`） |
| `npm run demo:type-check` | 型の検査 |
| `npm run demo:build` | ビルド |
| `npm run test:demo-e2e` | デモ版の画面の流れのテスト（Playwright） |

- デモ版は Supabase も環境変数も使わないので、`.env.local` は要りません
- 試すデータは `demo/public/sample-sales-demo.csv`（ダミー）です。画面にある見本 CSV のボタン（`SampleCsvButton`）からも入れられます

## Vercel の設定

デモ・LP は、本番とは別の Vercel プロジェクトに置きます。

| 設定 | 値 |
|---|---|
| Root Directory | `demo` |
| Install Command の Override | `cd .. && npm ci` |
| 環境変数 | なし |
| Node.js Version | `24.x` |
| Include source files outside of the Root Directory | ON のまま（`src/` を共有するため） |

- Install Command を上のとおりにする理由：インストールの場所は Root Directory で決まります。何もしないと `demo/` の中だけに入り、`src/` の部品が使うライブラリ（recharts など）が見つからずビルドが失敗します。`demo/next.config.ts` の `turbopack.root` がリポジトリ直下を指しているため、`src/` のファイルはリポジトリ直下の `node_modules` を探します
- この設定は Vercel の画面（Settings → Build and Deployment）にあり、**リポジトリのコードには書かれていません。** プロジェクトを作り直す・Git の連携先を付け替えるときは、同じ設定を入れ直します。Root Directory の「Skip deployment」が Disabled であることも確かめます
- ビルドが `Can't resolve 'recharts'` で失敗したら、Install Command の Override を確かめます
- ルートの `vercel.json` が `demo` を Root Directory にしたプロジェクトにも効くかは、公式に記載がなく**未確認**です。`demo/` か `src/` を変える push のあと、Deployments に新しい行が出るかで確かめます

## 注意

- 閲覧者の Gemini キーは、画面を開いている間だけメモリに持ちます。`localStorage`・`sessionStorage`・URL・Cookie には保存せず、コンソールにも出しません（`demo/lib/key-holder.ts`）
- キーの送り先は Google だけです。`demo/next.config.ts` の CSP（`connect-src`）で、自分自身と `https://generativelanguage.googleapis.com` に絞っています。第三者の解析スクリプトは足さないでください
- エラーを日本語の案内にするとき、入力されたキーや Google の返答の原文を含めません
- 試すのは**ダミーのデータだけ**にしてください。実際の売上データは入れません（無料枠の入力は、サービス改善に使われることがあるため）
