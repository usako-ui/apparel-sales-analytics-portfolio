// テスト用のお店2つとアカウント3つを作る（手元の検証用プロジェクトだけで使う。本番では実行しない）
// 実行：npm run seed:test（.env.local を Node が読み込む。値は画面・ログに出さない）
// 2回実行しても重複しない：お店は名前で、アカウントはメールアドレスで既存を探す
// .mts（ES モジュール）にしているのは、Node が CommonJS として読み直す警告を出さないため
import { createClient } from "@supabase/supabase-js";

type Role = "admin" | "operator";

const SHOP_LUMINA = "LUMINA";
const SHOP_OTHER = "テスト用のお店";

const accounts: { emailVar: string; passwordVar: string; displayName: string; role: Role; shop: string }[] = [
  { emailVar: "TEST_ADMIN_EMAIL", passwordVar: "TEST_ADMIN_PASSWORD", displayName: "テスト管理者", role: "admin", shop: SHOP_LUMINA },
  { emailVar: "TEST_OPERATOR_EMAIL", passwordVar: "TEST_OPERATOR_PASSWORD", displayName: "テスト操作者", role: "operator", shop: SHOP_LUMINA },
  { emailVar: "TEST_OTHER_SHOP_EMAIL", passwordVar: "TEST_OTHER_SHOP_PASSWORD", displayName: "別店テスト管理者", role: "admin", shop: SHOP_OTHER },
];

// 必要な変数がそろっているか。足りないときは変数名だけを出す（値は出さない）
function requireEnv(names: string[]): Record<string, string> {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`.env.local に値がありません：${missing.join("・")}`);
  }
  return Object.fromEntries(names.map((name) => [name, process.env[name] as string]));
}

async function main() {
  const env = requireEnv([
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    ...accounts.flatMap((a) => [a.emailVar, a.passwordVar]),
  ]);

  // テスト用のメール（@example.com）以外には触れない。本物のアカウントを書き換えないため、何もせずに止まる
  const notTestEmails = accounts.map((a) => a.emailVar).filter((name) => !env[name].toLowerCase().endsWith("@example.com"));
  if (notTestEmails.length > 0) {
    throw new Error(`テスト用のメール（@example.com）ではないため止めました：${notTestEmails.join("・")}`);
  }

  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // お店：名前で探し、なければ作る
  const shopIds = new Map<string, string>();
  for (const name of [SHOP_LUMINA, SHOP_OTHER]) {
    const { data: found, error: findError } = await admin.from("shops").select("id").eq("name", name).limit(1);
    if (findError) throw new Error(`お店の確認に失敗しました（${name}）：${findError.message}`);
    if (found.length > 0) {
      shopIds.set(name, found[0].id);
      console.log(`お店：既にある　${name}`);
      continue;
    }
    const { data: created, error: createError } = await admin.from("shops").insert({ name }).select("id").single();
    if (createError) throw new Error(`お店の作成に失敗しました（${name}）：${createError.message}`);
    shopIds.set(name, created.id);
    console.log(`お店：作成した　${name}`);
  }

  // 既存のアカウント（メールアドレス → ID）。テスト用プロジェクトは件数が少ないので全件を読む
  const existing = new Map<string, string>();
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`アカウント一覧の取得に失敗しました：${error.message}`);
    for (const user of data.users) {
      if (user.email) existing.set(user.email.toLowerCase(), user.id);
    }
    if (data.users.length < 1000) break;
  }

  for (const account of accounts) {
    const email = env[account.emailVar];
    let userId = existing.get(email.toLowerCase());

    if (userId) {
      // 既にある：パスワードは変えない。profiles だけ下で初期状態に戻す
      console.log(`アカウント：既にある　${email}`);
    } else {
      // メールは送らない（email_confirm: true で確認済みとして作る）
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: env[account.passwordVar],
        email_confirm: true,
      });
      if (error) throw new Error(`アカウントの作成に失敗しました（${email}）：${error.message}`);
      userId = data.user.id;
      console.log(`アカウント：作成した　${email}`);
    }

    // profiles：ロール・有効・初回のパスワード変更なし（自動テストでログインするため）に毎回そろえる
    const { error: profileError } = await admin.from("profiles").upsert(
      {
        user_id: userId,
        shop_id: shopIds.get(account.shop),
        display_name: account.displayName,
        role: account.role,
        status: "active",
        must_change_password: false,
      },
      { onConflict: "user_id" },
    );
    if (profileError) throw new Error(`profiles の登録に失敗しました（${email}）：${profileError.message}`);
  }

  console.log("完了：お店2つ・アカウント3つ");
}

main().catch((error: unknown) => {
  // エラーメッセージだけを出す（キー・パスワードを含むオブジェクトは出さない）
  console.error(error instanceof Error ? error.message : "不明なエラーが起きました");
  process.exitCode = 1;
});
