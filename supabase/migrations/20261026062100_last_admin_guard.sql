-- 案件8 有効な管理者が0人になる変更を、DBでも止める（architecture.md 第17項5）
--
-- 止めるもの：profiles の update／delete で、そのお店の「status='active' かつ role='admin'」の人が
--   0人になる変更。旧の行が「有効な管理者」で、新の行がそうでなくなる時だけ確認する
--   （管理者がまだいないお店に最初の人を入れる操作＝insert は対象外）
--
-- 同時操作への対策：お店ごとの advisory lock（pg_advisory_xact_lock）を取ってから数える。
--   例：管理者AとBが同時に「相手を外す」と、ロックなしでは両方とも「相手が残っている」と見えて両方通り、0人になる。
--   ロックがあると、2つ目の変更は1つ目が終わる（commit）まで待ち、終わった後の状態を数え直すので止まる。
-- なぜ「行ロック（for update）」にしないか：AがAの行、BがBの行を更新中に、お互いの行を
--   for update で取りにいくと待ち合って（デッドロック）、片方がエラーで落ちる。
--   お店単位の1本のロックなら、順番に並ぶだけでデッドロックにならない。
--   2つ引数の形（種類の数字, お店の数字）にして、他の用途の advisory lock と番号がぶつからないようにする。

create or replace function private.guard_last_active_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- 旧の行が「有効な管理者」でなければ、管理者の人数は減らないので確認しない
  if not (old.status = 'active' and old.role = 'admin') then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  -- update のとき：有効な管理者のままなら確認しない（名前の変更など）
  if tg_op = 'UPDATE'
     and new.status = 'active'
     and new.role = 'admin'
     and new.shop_id = old.shop_id then
    return new;
  end if;

  -- お店ごとにロックを取ってから数える（トランザクションが終わると自動で外れる）
  perform pg_advisory_xact_lock(hashtext('profiles_last_active_admin'), hashtext(old.shop_id::text));

  -- この行を除いて、有効な管理者が1人以上いればOK
  if exists (
    select 1
    from public.profiles p
    where p.shop_id = old.shop_id
      and p.status = 'active'
      and p.role = 'admin'
      and p.user_id <> old.user_id
  ) then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  -- delete だけの例外：そのお店に他のメンバーが1人もいなければ許す
  --   （空になるお店の後片付け。テスト用アカウントの掃除で使う。アプリはprofilesを削除しない）
  if tg_op = 'DELETE'
     and not exists (
       select 1 from public.profiles p
       where p.shop_id = old.shop_id and p.user_id <> old.user_id
     ) then
    return old;
  end if;

  -- サーバー側はこの 'last_active_admin' を見て日本語のメッセージに変える
  raise exception 'last_active_admin: 有効な管理者が0人になる変更はできません'
    using errcode = 'P0001',
          hint = 'そのお店に、有効な管理者をもう1人置いてから変更してください';
end;
$$;

-- トリガー関数はトリガー経由でだけ動けばよい。API（anon・authenticated）から呼べないようにする
revoke execute on function private.guard_last_active_admin() from public, anon, authenticated;

drop trigger if exists profiles_guard_last_active_admin on public.profiles;
create trigger profiles_guard_last_active_admin
  before update or delete on public.profiles
  for each row
  execute function private.guard_last_active_admin();
