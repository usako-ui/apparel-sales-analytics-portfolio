// 最初の管理者を作る（納品時に開発者が手元で実行する。service role を使うため、画面・サーバーには載せない）
// 実行：npm run admin:first -- --shop お店の名前 --email メールアドレス --name 表示名
// 有効な管理者がすでにいるお店では、何も作らず・何も変えずに止まる（終了コード 1）
// 一時パスワードは成功したときに1回だけ表示する。ログ・DB には残さない
import { createClient } from "@supabase/supabase-js";
import { createFirstAdmin } from "../src/lib/admin/first-admin.ts";

const USAGE = "使い方：npm run admin:first -- --shop お店の名前 --email メールアドレス --name 表示名";

// --key value の形だけを読む
function readArgs(argv: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key.startsWith("--") || value === undefined || value.startsWith("--")) {
      throw new Error(`引数を読み取れません。${USAGE}`);
    }
    result[key.slice(2)] = value;
  }
  return result;
}

async function main() {
  const args = readArgs(process.argv.slice(2));
  const shopName = args.shop;
  const email = args.email;
  const displayName = args.name;
  if (!shopName || !email || !displayName) throw new Error(`--shop・--email・--name をすべて指定してください。${USAGE}`);

  // 足りない変数の名前だけを出す（値は出さない）
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const missing = [
    !url && "NEXT_PUBLIC_SUPABASE_URL",
    !serviceRoleKey && "SUPABASE_SERVICE_ROLE_KEY",
  ].filter(Boolean);
  if (!url || !serviceRoleKey) throw new Error(`.env.local に値がありません：${missing.join("・")}`);

  const client = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const result = await createFirstAdmin(client, { shopName, email, displayName });

  if (!result.ok) {
    console.error(result.message);
    process.exitCode = 1;
    return;
  }

  console.log(result.shopCreated ? `お店を作成しました：${shopName}` : `お店：既にある　${shopName}`);
  console.log(`管理者を作成しました：${email}`);
  console.log(`一時パスワード：${result.temporaryPassword}`);
  console.log("この画面を閉じると二度と表示されません。初回ログイン時に変更が必要です。");
}

main().catch((error: unknown) => {
  // エラーメッセージだけを出す（キー・パスワードを含むオブジェクトは出さない）
  console.error(error instanceof Error ? error.message : "不明なエラーが起きました");
  process.exitCode = 1;
});
