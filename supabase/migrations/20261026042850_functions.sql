-- 案件8 DB関数（月ごとの置き換え・keepalive）
-- 設計の正本: 設計メモ（非公開）第4項・第14項
-- ※ replace_month_uploads は 20261026043631_private_helpers.sql で private.current_shop_id() を使う形に置き換えている

-- replace_month_uploads ------------------------------------------
-- 1つのCSVを「対象月ごと」に置き換える。関数1回の呼び出し = 1トランザクション
-- （途中で失敗したら全部元に戻る）。
--
-- security invoker: 呼んだ人の権限で動くので RLS が効く。
--   お店は current_shop_id()、アップロード者は auth.uid() から決める（引数では受け取らない）。
--   → 他のお店のデータを書き込めない。休職・退職の人は current_shop_id() が null で拒否される。
--
-- 引数
--   p_filename : text  元のCSVファイル名
--   p_months   : jsonb 月ごとの配列。1要素 = 1か月分
--     [
--       { "target_month": "2026-09",
--         "rows": [ { "order_date": "2026-09-03", "customer_id": "C001" または null,
--                     "product_name": "...", "category": "...", "sku": "...",
--                     "quantity": 1, "revenue": 7600, "cost": 3000 }, ... ] },
--       ...
--     ]
--   ・rows の order_date は target_month の月に属していること（違えば例外）
--   ・target_month の重複、空の配列、空の rows も例外
--   ・金額は整数（小数はアプリ側で除外済みの前提。小数が来たら型変換で例外）
--
-- 戻り値: 月ごとの結果（target_month, upload_id, row_count）。同じ batch_id でつながる
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
  v_shop_id  uuid := public.current_shop_id();
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

-- ログイン済みの人だけ実行できる（anon・public は不可）
revoke execute on function public.replace_month_uploads(text, jsonb) from public, anon, authenticated;
grant  execute on function public.replace_month_uploads(text, jsonb) to authenticated;

-- keepalive -------------------------------------------------------
-- Supabase の無料枠が停止しないよう、GitHub Actions から週1回呼ぶ軽い関数。
-- select 1 を返すだけでデータは読まない。公開キー（anon）で呼べる。
create or replace function public.keepalive()
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select 1
$$;

revoke execute on function public.keepalive() from public, anon, authenticated;
grant  execute on function public.keepalive() to anon, authenticated;
