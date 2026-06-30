-- 代理店（agency）ホワイトラベル用ブランド設定を profiles に追加
-- 実行方法: Supabase ダッシュボード → SQL Editor → Run
alter table public.profiles add column if not exists agency_brand_name text;
alter table public.profiles add column if not exists agency_logo_url text;
alter table public.profiles add column if not exists agency_accent text;
