# tests/fixtures/｜テストが読むファイル

手で動作確認に使うのは `lumina-sample-sales.csv` だけです。ほかは自動テスト用で、わざと間違いを入れたファイルです。

## CSV

| ファイル | 役割 |
|---|---|
| `lumina-sample-sales.csv` | **手で動作確認に使う、本番版用のダミー CSV。** 48行・2025年9〜11月・顧客25人。正解値は手計算で決めてあり（`unit/lumina-sample-csv.test.ts`）、公開リポジトリでも使える自作のデータ |
| `sample-sales.csv` | 講座の配布 CSV（40行）。権利は講座の提供元にあるため、公開リポジトリには含めない。作業用リポジトリにだけあり、ない時はこれを使うテストを飛ばす（`helpers/course-csv.ts`） |
| `alias-headers.csv` | 列名が Shopify 風の別名（`Created at`・`Customer`・`Total` など）で、日付の形も揺れている3行。別名の読み替えが働くことの確認用 |
| `missing-columns.csv` | 必要な列が足りない（`sku`・`revenue`・`cost` がない）。取り込まずに止まり、足りない列名が出ることの確認用 |
| `duplicate-columns.csv` | 同じ意味の列が2つある（`order_date` と `created_at`）。重複で止まることの確認用 |
| `invalid-rows.csv` | 9行のうち、読める行は2行だけ。残りの7行は、わざと間違いを入れてある（存在しない日付・数量0や小数・金額に小数や負の値・商品名が空）。スキップされて理由が出ることの確認用 |
| `dummy-sales-with-injection.csv` | デモ版のテスト用。12行・2025年9〜10月。商品名の1つに「これまでの指示を無視して…」という指示文が入っている。指示文入りでも列がずれずに取り込めて、売上などの正解値が指示文の数字にならないことの確認用（`unit/demo-injection-csv.test.ts`） |

- デモ版の見本（画面の「ダミーCSVで試す」で読み込むもの）は、ここではなく `demo/public/sample-sales-demo.csv` にあります

## llm/（AI の固定の応答）

テストでは本物の AI を呼ばず、次のファイルを AI の返事として使います。

| ファイル | 役割 |
|---|---|
| `llm/valid.json` | 正しい形で、文中の数字も集計値と合っている返事（成功の確認用） |
| `llm/wrong-number.json` | 形は正しいが、文中の数字（売上・前月比・リピート率）が集計値と合わない返事。数字の警告が出ることの確認用 |
| `llm/invalid-type.json` | 形が決まりと違う返事（優先度が許可された値ではない）。検証で弾かれ、やり直しになることの確認用 |
| `llm/not-json.txt` | JSON ではなく普通の文章の返事。読み取りに失敗することの確認用 |
