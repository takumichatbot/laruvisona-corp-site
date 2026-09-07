-- AI司令室 テーブル
-- Supabase SQL Editor で実行してください

CREATE TABLE IF NOT EXISTS public.ai_sessions (
  id text PRIMARY KEY,
  name text NOT NULL,
  cwd text NOT NULL,
  description text,
  color text DEFAULT 'sky',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL REFERENCES public.ai_sessions(id) ON DELETE CASCADE,
  message text NOT NULL,
  image_urls text[] DEFAULT '{}',
  status text DEFAULT 'pending' CHECK (status IN ('pending','running','done','error','cancelled')),
  output text DEFAULT '',
  auto_approve boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  error_message text
);

CREATE INDEX IF NOT EXISTS ai_commands_pending_idx ON public.ai_commands(created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS ai_commands_session_idx ON public.ai_commands(session_id, created_at DESC);

-- 運用テーブルは一般ユーザーから完全に遮断する。
-- 読み書きは service role（/api/ai-command/* と ai-watcher）のみ。
-- Realtime publication にも入れない（RLS を迂回して配信されるため）。
ALTER TABLE public.ai_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_commands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_sessions FROM anon, authenticated;
REVOKE ALL ON public.ai_commands FROM anon, authenticated;

-- Storageバケット (Storage > New Bucket でも可)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('ai-command-images', 'ai-command-images', true)
-- ON CONFLICT DO NOTHING;
