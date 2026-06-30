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
  customer_name text,
  customer_email text,
  customer_phone text,
  amount integer not null default 0,           -- 合計金額（円）
  items jsonb not null default '[]'::jsonb,      -- [{name, variant, quantity, unit}]
  shipping jsonb,                                -- {name, postal_code, state, city, line1, line2, country, phone}
  status text not null default 'paid' check (status in ('paid','shipped','completed','canceled')),
  note text,
  created_at timestamptz not null default now()
);

alter table public.hp_orders enable row level security;

drop policy if exists "Users see own orders" on public.hp_orders;
drop policy if exists "Users update own orders" on public.hp_orders;

create policy "Users see own orders" on public.hp_orders
  for select using (
    site_id in (select id from public.sites where user_id = auth.uid())
  );

create policy "Users update own orders" on public.hp_orders
  for update using (
    site_id in (select id from public.sites where user_id = auth.uid())
  );

create index if not exists hp_orders_site_idx on public.hp_orders (site_id, created_at desc);
