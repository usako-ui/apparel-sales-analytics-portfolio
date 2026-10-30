-- 案件8 RLS の補助関数を API に出ない private スキーマへ移す
-- 理由: Supabase のセキュリティチェック（lint 0029）で、security definer の
--   public.current_shop_id()・public.is_shop_admin() がログイン中の人から
--   /rest/v1/rpc/... で直接呼べると警告されたため。
--   private スキーマは API（PostgREST）に公開されないので、RLS の中からだけ使える。

create schema if not exists private;
revoke all on schema private from public, anon;
-- RLS のポリシーは呼んだ人（authenticated）の権限で評価されるため、usage と execute が要る
grant usage on schema private to authenticated;

-- ログイン中の人のお店ID。status が active のときだけ値を返す（それ以外は null）
create or replace function private.current_shop_id()
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
create or replace function private.is_shop_admin()
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

revoke execute on function private.current_shop_id() from public, anon;
revoke execute on function private.is_shop_admin()   from public, anon;
grant  execute on function private.current_shop_id() to authenticated;
grant  execute on function private.is_shop_admin()   to authenticated;

-- ポリシーを private の関数に付け替える（中身は 20261026042727_rls.sql と同じ）
alter policy shops_select on public.shops
  using (id = private.current_shop_id());

alter policy profiles_select on public.profiles
  using (shop_id = private.current_shop_id());

alter policy admin_logs_select on public.admin_logs
  using (shop_id = private.current_shop_id() and private.is_shop_admin());

alter policy uploads_select on public.uploads
  using (shop_id = private.current_shop_id());

alter policy uploads_insert on public.uploads
  with check (
    shop_id = private.current_shop_id()
    and user_id = (select auth.uid())
  );

alter policy uploads_delete on public.uploads
  using (shop_id = private.current_shop_id());

alter policy sales_data_select on public.sales_data
  using (shop_id = private.current_shop_id());

alter policy sales_data_insert on public.sales_data
  with check (
    shop_id = private.current_shop_id()
    and exists (
      select 1 from public.uploads u
      where u.id = sales_data.upload_id
        and u.shop_id = sales_data.shop_id
    )
  );

alter policy reports_select on public.reports
  using (shop_id = private.current_shop_id());

alter policy reports_insert on public.reports
  with check (
    shop_id = private.current_shop_id()
    and exists (
      select 1 from public.uploads u
      where u.id = reports.upload_id
        and u.shop_id = reports.shop_id
    )
  );

-- replace_month_uploads の中の呼び出しも付け替える（それ以外は 20261026042850_functions.sql と同じ）
create or replace function public.replace_month_uploads(
  p_filename text,
  p_months   jsonb
)
returns table (target_month text, upload_id uuid, row_count integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_shop_id  uuid := private.current_shop_id();
  v_user_id  uuid := (select auth.uid());
  v_batch_id uuid := gen_random_uuid();
  v_month    jsonb;
  v_target   text;
  v_upload   uuid;
begin
  if v_shop_id is null or v_user_id is null then
    raise exception 'permission denied: no active shop' using errcode = '42501';
  end if;

  if p_months is null or jsonb_typeof(p_months) <> 'array' or jsonb_array_length(p_months) = 0 then
    raise exception 'p_months must be a non-empty json array';
  end if;

  if (select count(*) <> count(distinct m ->> 'target_month')
      from jsonb_array_elements(p_months) as m) then
    raise exception 'duplicate target_month in p_months';
  end if;

  for v_month in select * from jsonb_array_elements(p_months)
  loop
    v_target := v_month ->> 'target_month';

    if v_target is null
       or jsonb_typeof(v_month -> 'rows') <> 'array'
       or jsonb_array_length(v_month -> 'rows') = 0 then
      raise exception 'each month needs target_month and non-empty rows';
    end if;

    -- 古い uploads を削除（sales_data・reports は ON DELETE CASCADE で一緒に消える）
    delete from public.uploads u
    where u.shop_id = v_shop_id
      and u.target_month = v_target;

    insert into public.uploads (shop_id, user_id, batch_id, filename, target_month, row_count)
    values (v_shop_id, v_user_id, v_batch_id, p_filename, v_target,
            jsonb_array_length(v_month -> 'rows'))
    returning id into v_upload;

    insert into public.sales_data
      (upload_id, shop_id, order_date, customer_id, product_name, category, sku,
       quantity, revenue, cost)
    select v_upload, v_shop_id, r.order_date, r.customer_id, r.product_name, r.category, r.sku,
           r.quantity, r.revenue, r.cost
    from jsonb_to_recordset(v_month -> 'rows') as r (
      order_date   text,
      customer_id  text,
      product_name text,
      category     text,
      sku          text,
      quantity     integer,
      revenue      integer,
      cost         integer
    );

    -- 行の日付が対象月に属しているか（月の取り違えで別の月に混ざるのを防ぐ）
    if exists (
      select 1 from public.sales_data s
      where s.upload_id = v_upload
        and left(s.order_date, 7) <> v_target
    ) then
      raise exception 'order_date does not belong to target_month %', v_target;
    end if;

    target_month := v_target;
    upload_id    := v_upload;
    row_count    := jsonb_array_length(v_month -> 'rows');
    return next;
  end loop;
end;
$$;

-- 古い public の補助関数を消す（どこからも使われなくなったため）
drop function public.current_shop_id();
drop function public.is_shop_admin();
