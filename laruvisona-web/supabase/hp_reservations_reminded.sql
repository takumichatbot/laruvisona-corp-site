-- 予約のメールリマインダー送信済みフラグ。
-- 実行方法: Supabase ダッシュボード → SQL Editor → Run
alter table public.hp_reservations add column if not exists reminded boolean not null default false;
