-- ─────────────────────────────────────────────────────────────────────────────
-- hp_reservations: 時間枠カレンダー予約（在庫連動・二重予約防止・事前決済）
--
-- 実行方法: Supabase ダッシュボード → SQL Editor → このSQLを貼り付けて Run
--
-- 設計:
--   - slot_id は sites.data.bookingConfig.slots[].id を指す
--   - status: pending（決済待ち/仮押さえ）→ confirmed（確定）/ canceled
--   - 二重予約は部分ユニークインデックスで DB レベルに防止
--     （同一サイト・同一スロットで canceled 以外は1件のみ）
--   - 公開フォームからの INSERT は service-role（reserve API）経由で RLS をバイパス
--   - オーナーは自分のサイトの予約だけ select / update 可能
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.hp_reservations (
  id uuid default gen_random_uuid() primary key,
  site_id uuid references public.sites(id) on delete cascade not null,
  slot_id text not null,
  slot_datetime timestamptz not null,
  service text,
  name text not null,
  email text not null,
  phone text,
  amount integer not null default 0,          -- 予約金（円）。0 = 決済なし
  status text not null default 'pending' check (status in ('pending','confirmed','canceled')),
  stripe_session_id text,
  created_at timestamptz not null default now()
);

alter table public.hp_reservations enable row level security;

create policy "Users see own reservations" on public.hp_reservations
  for select using (
    site_id in (select id from public.sites where user_id = auth.uid())
  );

create policy "Users update own reservations" on public.hp_reservations
  for update using (
    site_id in (select id from public.sites where user_id = auth.uid())
  );

-- 二重予約防止: canceled 以外は (site_id, slot_id) で一意
create unique index if not exists hp_reservations_slot_unique
  on public.hp_reservations (site_id, slot_id)
  where status <> 'canceled';

create index if not exists hp_reservations_site_idx
  on public.hp_reservations (site_id, slot_datetime);
