-- ─────────────────────────────────────────────────────────────────────────────
-- sites.data 列の追加
--
-- 予約枠管理(bookingConfig)・代理店設定などが sites.data(jsonb) を使うが、
-- 元の schema.sql にこの列が無く、参照クエリが失敗していた
-- （/laruHP/booking が無限ローディングになる原因）。
--
-- 実行方法: Supabase ダッシュボード → SQL Editor → 貼り付けて Run
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.sites add column if not exists data jsonb not null default '{}'::jsonb;
