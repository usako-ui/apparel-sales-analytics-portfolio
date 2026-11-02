# tests/｜自動テスト（開発用）

開発者向けの資料です。お客様（操作者・管理者）は見なくてかまいません。手元での動かし方は [開発者・保守ガイド](../docs/developer-guide.md) の第2・3章にあります。

| フォルダ | 何のテストか | いつ・どのコマンドで動くか | CI で動くか |
|---|---|---|---|
| `unit/` | 集計の正解値・CSV の読み取り・AI の出力の型と数字の照合・画面の文言など、サーバーや DB を使わないテスト。デモ版のダミー CSV の正解値テストも含む。AI は呼ばず、固定の応答を使う | 手元でも CI でも。`npm run test` | 動く（`check` job） |
| `integration/` | 権限（RLS）と、管理者・取り込み・ログイン判定の結合テスト。実際の Supabase につなぐ（手元は検証用の Supabase とテスト用アカウントが必要） | 手元で `npm run test:rls` | 動く（`rls` job。実行の中で使い捨ての Supabase を起動する） |
| `e2e/` | 本番版の画面の流れ（ログイン・取り込み・ダッシュボード・AI 分析の表示・スマホ幅）。検証用の Supabase につなぐ。このフォルダには、スクショや PDF を作るファイルも入っていて、環境変数がない時は何もせず飛ばす | 手元で `npm run test:e2e`（スクショは `npm run screenshot` など） | 動かない（手元だけ） |
| `demo-e2e/` | デモ版（`demo/`）の画面の流れ。Gemini への通信はモックで、本物は呼ばない | 手元で `npm run test:demo-e2e` | 動かない（手元だけ。CI はデモ版の型チェックとビルドだけ行う） |
| `fixtures/` | テストが読む CSV と、AI の固定の応答。案内は [fixtures/README.md](fixtures/README.md) | テストから読まれる | （テストと同じ） |
| `helpers/` | `course-csv.ts`：講座の配布 CSV（`fixtures/sample-sales.csv`）があるかを調べ、ない時はそれを使うテストを飛ばす | テストから読まれる | （テストと同じ） |

- `integration/helpers.ts` と `e2e/support.ts`・`demo-e2e/support.ts` は、それぞれのフォルダのテストが使う共通の道具です
- 手元で `integration/` と `e2e/` を動かすには、`.env.local` に Supabase のキーとテスト用アカウントの値が必要です（[開発者・保守ガイド](../docs/developer-guide.md) の第5章）
- テストを通すために、正解値（`unit/lumina-sample-csv.test.ts` など）を書き換えないでください。合わない時は実装を疑います
