-- ─────────────────────────────────────────────────────────────────────────────
-- hp_members: 公開サイトの「会員」（来訪者向け・サイトオーナーとは別）
--
-- 実行方法: Supabase ダッシュボード → SQL Editor → 貼り付けて Run
--
-- 設計:
--   - サイトごとの会員。email+パスワード（ハッシュ）で認証し、JWTを発行。
--   - 読み書きはサーバーAPI（service role）経由。来訪者がauth.usersになる必要は無い。
--   - オーナーは自分のサイトの会員一覧を閲覧できる（RLS select）。
--   - plan: free | paid、status: active | inactive（有料はStripeサブスクで有効化）
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.hp_members (
  id uuid default gen_random_uuid() primary key,
  site_id uuid references public.sites(id) on delete cascade not null,
  email text not null,
  password_hash text not null,
  name text,
  plan text not null default 'free' check (plan in ('free','paid')),
  status text not null default 'active' check (status in ('active','inactive')),
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  unique (site_id, email)
);

alter table public.hp_members enable row level security;

drop policy if exists "Owners view site members" on public.hp_members;
create policy "Owners view site members" on public.hp_members
  for select using (
    site_id in (select id from public.sites where user_id = auth.uid())
  );

create index if not exists hp_members_site_idx on public.hp_members (site_id, created_at desc);
