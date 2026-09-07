-- AI司令室 v2 追加スキーマ
-- Supabase SQL Editor で実行してください

-- プロジェクトごとの常設コンテキスト
ALTER TABLE public.ai_sessions ADD COLUMN IF NOT EXISTS system_context text;

-- Watcher 生存確認テーブル
CREATE TABLE IF NOT EXISTS public.watcher_heartbeat (
  id text PRIMARY KEY DEFAULT 'main',
  last_seen timestamptz DEFAULT now()
);
ALTER TABLE public.watcher_heartbeat ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.watcher_heartbeat FROM anon, authenticated;
INSERT INTO public.watcher_heartbeat (id) VALUES ('main') ON CONFLICT DO NOTHING;
