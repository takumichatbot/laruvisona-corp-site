-- 代理店の「管理画面 独自ドメイン」（ホワイトラベル）
-- 実行方法: Supabase ダッシュボード → SQL Editor → Run
alter table public.profiles add column if not exists agency_admin_domain text;
create unique index if not exists profiles_agency_admin_domain_uidx
  on public.profiles (agency_admin_domain) where agency_admin_domain is not null;
