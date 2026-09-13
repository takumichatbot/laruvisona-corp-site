-- ─────────────────────────────────────────────────────────────────────────────
-- hp_orders: ショップの注文履歴（決済完了時にwebhookが保存）
--
-- 実行方法: Supabase ダッシュボード → SQL Editor → 貼り付けて Run
--
-- 設計:
--   - Stripe Checkout 完了(webhook)で1注文を保存。読み書きは service role 経由。
--   - オーナーは自分のサイトの注文だけ select / update 可能（RLS）。
--   - items は購入明細(jsonb)、shipping は配送先(jsonb)。
--   - status: paid（入金済）→ shipped（発送済）→ completed / canceled
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.hp_orders (
  id uuid default gen_random_uuid() primary key,
  site_id uuid references public.sites(id) on delete cascade not null,
  stripe_session_id text unique,
  stripe_account_id text,
  stripe_payment_intent_id text,
  refund_id text,
  refund_started_at timestamptz,
  customer_name text,
  customer_email text,
  customer_phone text,
  amount integer not null default 0,           -- 合計金額（円）
  items jsonb not null default '[]'::jsonb,      -- [{name, variant, quantity, unit}]
  shipping jsonb,                                -- {name, postal_code, state, city, line1, line2, country, phone}
  status text not null default 'paid' check (status in ('paid','review','shipped','completed','canceled','refund_pending','refunded','refund_review')),
  note text,
  created_at timestamptz not null default now()
);

alter table public.hp_orders add column if not exists stripe_account_id text;
alter table public.hp_orders add column if not exists stripe_payment_intent_id text;
alter table public.hp_orders add column if not exists refund_id text;
alter table public.hp_orders add column if not exists refund_started_at timestamptz;
alter table public.hp_orders add column if not exists notified_at timestamptz;
alter table public.hp_orders add column if not exists notification_attempts integer not null default 0;
alter table public.hp_orders add column if not exists next_notification_at timestamptz not null default (now() + interval '2 minutes');
alter table public.hp_orders add column if not exists notification_claim_token uuid;
alter table public.hp_orders add column if not exists notification_claimed_until timestamptz;
alter table public.hp_orders add column if not exists notification_last_error text;

do $$ begin
  if not exists(select 1 from pg_constraint where conrelid='public.hp_orders'::regclass and conname='hp_orders_notification_attempts') then
    alter table public.hp_orders add constraint hp_orders_notification_attempts check(notification_attempts between 0 and 5);
  end if;
  if not exists(select 1 from pg_constraint where conrelid='public.hp_orders'::regclass and conname='hp_orders_notification_lease') then
    alter table public.hp_orders add constraint hp_orders_notification_lease check((notification_claim_token is null)=(notification_claimed_until is null));
  end if;
end $$;

alter table public.hp_orders enable row level security;

alter table public.hp_orders drop constraint if exists hp_orders_status_check;
alter table public.hp_orders add constraint hp_orders_status_check
  check (status in ('paid','review','shipped','completed','canceled','refund_pending','refunded','refund_review'));

drop policy if exists "Users see own orders" on public.hp_orders;
drop policy if exists "Users update own orders" on public.hp_orders;

create policy "Users see own orders" on public.hp_orders
  for select using (
    site_id in (select id from public.sites where user_id = auth.uid())
  );

create policy "Users update own orders" on public.hp_orders
  for update using (
    site_id in (select id from public.sites where user_id = auth.uid())
  ) with check (
    site_id in (select id from public.sites where user_id = auth.uid())
  );

revoke all on public.hp_orders from anon, authenticated;
grant select on public.hp_orders to authenticated;
grant update (status, note) on public.hp_orders to authenticated;

create index if not exists hp_orders_site_idx on public.hp_orders (site_id, created_at desc);
create index if not exists hp_orders_notification_due on public.hp_orders(next_notification_at,created_at)
  where notified_at is null;

create or replace function public.laruhp_order_status_guard() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = old.status then return new; end if;
  if (new.status in ('refund_pending','refunded','refund_review') or old.status in ('refund_pending','refund_review'))
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'refund_requires_service_role';
  end if;
  if not (
    (old.status in ('paid','review') and new.status in ('shipped','completed','refund_pending')) or
    (old.status = 'shipped' and new.status in ('completed','refund_pending')) or
    (old.status = 'completed' and new.status = 'refund_pending') or
    (old.status = 'refund_pending' and new.status in ('refunded','refund_review')) or
    (old.status = 'refund_review' and new.status in ('refund_pending','refunded'))
  ) then
    raise exception 'invalid_order_transition';
  end if;
  return new;
end;
$$;

drop trigger if exists lhp_order_status_guard_trg on public.hp_orders;
create trigger lhp_order_status_guard_trg
before update of status on public.hp_orders
for each row execute function public.laruhp_order_status_guard();

revoke all on function public.laruhp_order_status_guard() from public, anon, authenticated;

-- Stripe Webhookの再送と同時購入を、サイト行のロック内で1回だけ処理する。
-- 在庫が足りない・商品が編集済みなどの場合も、支払い済み注文自体は review として残す。
create or replace function public.laruhp_shop_commit_order(
  p_site_id uuid,
  p_stripe_session_id text,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_amount integer,
  p_items jsonb,
  p_shipping jsonb,
  p_cart jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_site public.sites%rowtype;
  v_existing public.hp_orders%rowtype;
  v_order public.hp_orders%rowtype;
  v_settings jsonb;
  v_products jsonb;
  v_cart_item jsonb;
  v_product jsonb;
  v_variant jsonb;
  v_variants jsonb;
  v_product_pos integer;
  v_variant_pos integer;
  v_quantity integer;
  v_stock integer;
  v_inventory_ok boolean := true;
begin
  if p_stripe_session_id is null or length(p_stripe_session_id) < 3 or p_amount is null or p_amount < 0 then
    raise exception 'invalid_order';
  end if;
  if p_items is null or jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) < 1 then
    raise exception 'invalid_items';
  end if;

  select * into v_site from public.sites where id = p_site_id for update;
  if not found then raise exception 'site_not_found'; end if;

  select * into v_existing from public.hp_orders where stripe_session_id = p_stripe_session_id;
  if found then
    return jsonb_build_object('created', false, 'id', v_existing.id, 'status', v_existing.status);
  end if;

  v_settings := coalesce(v_site.settings_json, '{}'::jsonb);
  v_products := coalesce(v_settings->'products', '[]'::jsonb);
  if p_cart is null or jsonb_typeof(p_cart) is distinct from 'array' or jsonb_array_length(p_cart) < 1
     or jsonb_array_length(p_cart) <> jsonb_array_length(p_items)
     or jsonb_typeof(v_products) is distinct from 'array' then
    v_inventory_ok := false;
  else
    for v_cart_item in select value from jsonb_array_elements(p_cart)
    loop
      begin
        v_quantity := (v_cart_item->>'q')::integer;
      exception when others then
        v_inventory_ok := false;
        exit;
      end;
      if v_quantity is null or v_quantity < 1 or v_quantity > 99 then v_inventory_ok := false; exit; end if;

      select value, ordinality::integer into v_product, v_product_pos
        from jsonb_array_elements(v_products) with ordinality
        where value->>'id' = v_cart_item->>'id' and value->>'active' = 'true'
        limit 1;
      if not found then v_inventory_ok := false; exit; end if;

      if coalesce(v_cart_item->>'v', '') <> '' then
        v_variants := coalesce(v_product->'variants', '[]'::jsonb);
        select value, ordinality::integer into v_variant, v_variant_pos
          from jsonb_array_elements(v_variants) with ordinality
          where value->>'id' = v_cart_item->>'v'
          limit 1;
        if not found then v_inventory_ok := false; exit; end if;
        if v_variant->'stock' is not null and v_variant->'stock' <> 'null'::jsonb then
          begin v_stock := (v_variant->>'stock')::integer;
          exception when others then v_inventory_ok := false; exit; end;
          if v_stock < v_quantity then v_inventory_ok := false; exit; end if;
          v_variants := jsonb_set(v_variants, array[(v_variant_pos - 1)::text, 'stock'], to_jsonb(v_stock - v_quantity), false);
          v_product := jsonb_set(v_product, '{variants}', v_variants, false);
          v_products := jsonb_set(v_products, array[(v_product_pos - 1)::text], v_product, false);
        end if;
      elsif v_product->'stock' is not null and v_product->'stock' <> 'null'::jsonb then
        begin v_stock := (v_product->>'stock')::integer;
        exception when others then v_inventory_ok := false; exit; end;
        if v_stock < v_quantity then v_inventory_ok := false; exit; end if;
        v_products := jsonb_set(v_products, array[(v_product_pos - 1)::text, 'stock'], to_jsonb(v_stock - v_quantity), false);
      end if;
    end loop;
  end if;

  if v_inventory_ok then
    update public.sites
      set settings_json = jsonb_set(v_settings, '{products}', v_products, true)
      where id = p_site_id;
  end if;

  insert into public.hp_orders (
    site_id, stripe_session_id, customer_name, customer_email, customer_phone,
    amount, items, shipping, status, note
  ) values (
    p_site_id, p_stripe_session_id, p_customer_name, p_customer_email, p_customer_phone,
    p_amount, p_items, p_shipping,
    case when v_inventory_ok then 'paid' else 'review' end,
    case when v_inventory_ok then null else '決済後の在庫確認が必要です' end
  ) returning * into v_order;

  return jsonb_build_object(
    'created', true,
    'id', v_order.id,
    'status', v_order.status,
    'inventoryUpdated', v_inventory_ok
  );
end;
$$;

revoke all on function public.laruhp_shop_commit_order(uuid,text,text,text,text,integer,jsonb,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.laruhp_shop_commit_order(uuid,text,text,text,text,integer,jsonb,jsonb,jsonb) to service_role;

create or replace function public.laruhp_shop_claim_notifications(p_limit integer default 20)
returns table(order_id uuid,claim_token uuid) language plpgsql security definer set search_path=public as $$
begin
  update hp_orders set notification_claim_token=null,notification_claimed_until=null,
    next_notification_at=now(),notification_last_error='stale_claim'
  where notified_at is null and notification_claimed_until<=now();
  return query with due as (
    select o.id from hp_orders o where o.notified_at is null and o.notification_attempts<5
      and o.next_notification_at<=now() and o.created_at>now()-interval '23 hours'
      and o.notification_claim_token is null
    order by o.next_notification_at,o.created_at for update of o skip locked limit greatest(1,least(p_limit,100))
  ), claimed as (
    update hp_orders o set notification_attempts=o.notification_attempts+1,
      notification_claim_token=gen_random_uuid(),notification_claimed_until=now()+interval '10 minutes'
    from due where o.id=due.id returning o.id,o.notification_claim_token
  ) select c.id,c.notification_claim_token from claimed c;
end $$;

create or replace function public.laruhp_shop_finish_notification(
  p_order_id uuid,p_claim_token uuid,p_success boolean,p_error text default null
) returns boolean language plpgsql security definer set search_path=public as $$
declare n integer;
begin
  update hp_orders set notification_claim_token=null,notification_claimed_until=null,
    next_notification_at=case when p_success or notification_attempts>=5 then next_notification_at
      else now()+make_interval(mins=>least(60,5*power(2,greatest(notification_attempts-1,0))::integer)) end,
    notification_last_error=case when p_success then null else left(coalesce(p_error,'delivery_failed'),500) end
  where id=p_order_id and notification_claim_token=p_claim_token and (not p_success or notified_at is not null);
  get diagnostics n=row_count; return n=1;
end $$;

revoke all on function public.laruhp_shop_claim_notifications(integer),public.laruhp_shop_finish_notification(uuid,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.laruhp_shop_claim_notifications(integer),public.laruhp_shop_finish_notification(uuid,uuid,boolean,text) to service_role;
