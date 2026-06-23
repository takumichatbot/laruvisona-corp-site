-- AI司令室 v3 追加スキーマ
-- Supabase SQL Editor で実行してください

ALTER TABLE public.ai_commands ADD COLUMN IF NOT EXISTS git_diff_stat text;
ALTER TABLE public.ai_commands ADD COLUMN IF NOT EXISTS git_diff text;
ALTER TABLE public.ai_commands ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.ai_commands(id);
ALTER TABLE public.ai_commands ADD COLUMN IF NOT EXISTS context_output text;
ALTER TABLE public.ai_commands ADD COLUMN IF NOT EXISTS auto_retry boolean DEFAULT false;

-- Watcher ヘルス情報（ブランチ・未コミット数）
CREATE TABLE IF NOT EXISTS public.watcher_health (
  session_id text PRIMARY KEY REFERENCES public.ai_sessions(id) ON DELETE CASCADE,
  git_branch text,
  uncommitted_count int DEFAULT 0,
  last_commit_msg text,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.watcher_health DISABLE ROW LEVEL SECURITY;
ALTER PUBLICATION supabase_realtime ADD TABLE public.watcher_health;
