-- 案件8 RLS（行レベルセキュリティ）
-- 設計の正本: 設計メモ（非公開）第5項
-- 方針: 全テーブルで RLS 有効。休職・退職は current_shop_id() が null になり 0件になる。
-- profiles / admin_logs の書き込みは service role（RLS を迂回）だけ。ポリシーは作らない。
-- ※ 補助関数は 20261026043631_private_helpers.sql で private スキーマへ移している

-- 基本の関数 ------------------------------------------------------
-- security definer: profiles 自身の RLS を再帰的に踏まずに読むため。
-- search_path を空にして、同名オブジェクトのすり替えを防ぐ（スキーマ名を必ず付ける）。

-- ログイン中の人のお店ID。status が active のときだけ値を返す（それ以外は null）
create or replace function public.current_shop_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.shop_id
  from public.profiles p
  where p.user_id = (select auth.uid())
    and p.status = 'active'
$$;

-- 有効な管理者か
create or replace function public.is_shop_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = (select auth.uid())
      and p.status = 'active'
      and p.role = 'admin'
  )
$$;

-- execute は RLS で使う authenticated だけ（anon・public には渡さない）
revoke execute on function public.current_shop_id() from public, anon, authenticated;
revoke execute on function public.is_shop_admin()   from public, anon, authenticated;
grant  execute on function public.current_shop_id() to authenticated;
grant  execute on function public.is_shop_admin()   to authenticated;

-- テーブル権限 ----------------------------------------------------
-- Supabase は初期設定で anon / authenticated に広い権限を付けるので、いったん外して必要分だけ付ける
revoke all on table public.shops, public.profiles, public.admin_logs,
                    public.uploads, public.sales_data, public.reports
  from public, anon, authenticated;
revoke all on sequence public.admin_logs_id_seq, public.sales_data_id_seq
  from public, anon, authenticated;

grant select         on public.shops      to authenticated;
grant select         on public.profiles   to authenticated;
grant select         on public.admin_logs to authenticated;
grant select, insert, delete on public.uploads    to authenticated;
grant select, insert         on public.sales_data to authenticated;
grant select, insert         on public.reports    to authenticated;
-- sales_data の id は identity（自動採番）。挿入する側に採番の権限が要る
grant usage on sequence public.sales_data_id_seq to authenticated;

-- RLS を有効化 ----------------------------------------------------
alter table public.shops      enable row level security;
alter table public.profiles   enable row level security;
alter table public.admin_logs enable row level security;
alter table public.uploads    enable row level security;
alter table public.sales_data enable row level security;
alter table public.reports    enable row level security;
-- テーブルの持ち主にも RLS を適用（取りこぼし防止）。service role は BYPASSRLS で影響なし
alter table public.shops      force row level security;
alter table public.profiles   force row level security;
alter table public.admin_logs force row level security;
alter table public.uploads    force row level security;
alter table public.sales_data force row level security;
alter table public.reports    force row level security;

-- shops: 自分のお店だけ見える。書き込みなし ------------------------
create policy shops_select on public.shops
  for select to authenticated
  using (id = public.current_shop_id());

-- profiles: 同じお店の人が見える（管理者画面の一覧）。書き込みなし（service role のみ）
create policy profiles_select on public.profiles
  for select to authenticated
  using (shop_id = public.current_shop_id());

-- admin_logs: 同じお店の管理者だけ見える。書き込みなし（service role のみ）
create policy admin_logs_select on public.admin_logs
  for select to authenticated
  using (shop_id = public.current_shop_id() and public.is_shop_admin());

-- uploads: 同じお店が見える／自分名義で追加／同じお店は削除（月の置き換えのため）。update なし
create policy uploads_select on public.uploads
  for select to authenticated
  using (shop_id = public.current_shop_id());

create policy uploads_insert on public.uploads
  for insert to authenticated
  with check (
    shop_id = public.current_shop_id()
    and user_id = (select auth.uid())
  );

create policy uploads_delete on public.uploads
  for delete to authenticated
  using (shop_id = public.current_shop_id());

-- sales_data: 同じお店が見える／追加は upload と同じお店のときだけ。update・直接 delete なし（CASCADE のみ）
create policy sales_data_select on public.sales_data
  for select to authenticated
  using (shop_id = public.current_shop_id());

create policy sales_data_insert on public.sales_data
  for insert to authenticated
  with check (
    shop_id = public.current_shop_id()
    and exists (
      select 1 from public.uploads u
      where u.id = sales_data.upload_id
        and u.shop_id = sales_data.shop_id
    )
  );

-- reports: 同じお店が見える／追加は upload と同じお店のときだけ。update・直接 delete なし（CASCADE のみ）
create policy reports_select on public.reports
  for select to authenticated
  using (shop_id = public.current_shop_id());

create policy reports_insert on public.reports
  for insert to authenticated
  with check (
    shop_id = public.current_shop_id()
    and exists (
      select 1 from public.uploads u
      where u.id = reports.upload_id
        and u.shop_id = reports.shop_id
    )
  );
