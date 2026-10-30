-- 案件8 初期スキーマ（テーブル・制約・インデックス）
-- 設計の正本: 設計メモ（非公開）第3項
-- 金額は integer（円）、日付は text（YYYY-MM-DD）、月は text（YYYY-MM）。
-- RLS・関数は次のファイル（..._rls.sql / ..._functions.sql）で設定する。

-- お店 ------------------------------------------------------------
create table public.shops (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(btrim(name)) > 0),
  created_at timestamptz not null default now()
);

-- メンバー（ロール・状態の正本。認証そのものは Supabase Auth） ------
create table public.profiles (
  user_id              uuid primary key references auth.users (id) on delete cascade,
  shop_id              uuid not null references public.shops (id),
  display_name         text not null check (length(btrim(display_name)) > 0),
  role                 text not null check (role in ('admin', 'operator')),
  status               text not null default 'active' check (status in ('active', 'leave', 'retired')),
  must_change_password boolean not null default true,
  last_login_at        timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index profiles_shop_id_idx on public.profiles (shop_id);

-- 管理者操作の記録（追記のみ。detail にパスワードは入れない） -------
-- actor_id / target_id は外部キーにしない（アカウントが将来消えても記録を残すため）
create table public.admin_logs (
  id         bigint generated always as identity primary key,
  shop_id    uuid not null references public.shops (id),
  actor_id   uuid not null,
  target_id  uuid,
  action     text not null check (action in ('create', 'reissue', 'status', 'role', 'edit')),
  detail     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index admin_logs_shop_created_idx on public.admin_logs (shop_id, created_at desc);

-- アップロードの記録（1つのCSVを対象月ごとに分けて、月ごとに1行） --
create table public.uploads (
  id           uuid primary key default gen_random_uuid(),
  shop_id      uuid not null references public.shops (id),
  user_id      uuid not null references auth.users (id),
  batch_id     uuid not null,
  filename     text not null,
  target_month text not null check (target_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  row_count    integer not null check (row_count >= 0),
  uploaded_at  timestamptz not null default now(),
  -- 同じお店・同じ月の二重計上をDBの制約でも防ぐ
  constraint uploads_shop_month_key unique (shop_id, target_month)
);
create index uploads_batch_id_idx on public.uploads (batch_id);

-- 売上明細（shop_id を持たせて RLS を結合なしで書く） --------------
create table public.sales_data (
  id           bigint generated always as identity primary key,
  upload_id    uuid not null references public.uploads (id) on delete cascade,
  shop_id      uuid not null references public.shops (id),
  order_date   text not null check (order_date ~ '^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$'),
  customer_id  text,
  product_name text not null,
  category     text not null,
  sku          text not null,
  quantity     integer not null check (quantity >= 1),
  revenue      integer not null check (revenue >= 0),
  cost         integer not null check (cost >= 0)
);
create index sales_data_shop_order_date_idx on public.sales_data (shop_id, order_date);
create index sales_data_shop_category_idx   on public.sales_data (shop_id, category);
create index sales_data_upload_id_idx       on public.sales_data (upload_id);

-- AI分析結果（uploads に結ぶので、月を上書きすると古いコメントも消える） --
create table public.reports (
  id                 uuid primary key default gen_random_uuid(),
  upload_id          uuid not null references public.uploads (id) on delete cascade,
  shop_id            uuid not null references public.shops (id),
  target_month       text not null check (target_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  result             jsonb not null,
  llm_provider       text not null check (llm_provider in ('claude', 'gemini')),
  has_number_warning boolean not null default false,
  input_tokens       integer check (input_tokens >= 0),
  output_tokens      integer check (output_tokens >= 0),
  generated_by       uuid references auth.users (id),
  generated_at       timestamptz not null default now()
);
create index reports_shop_month_idx on public.reports (shop_id, target_month, generated_at desc);
create index reports_upload_id_idx  on public.reports (upload_id);
