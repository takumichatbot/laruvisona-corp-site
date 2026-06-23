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
  auto_approve boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  error_message text
);

CREATE INDEX IF NOT EXISTS ai_commands_pending_idx ON public.ai_commands(created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS ai_commands_session_idx ON public.ai_commands(session_id, created_at DESC);

ALTER TABLE public.ai_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_commands DISABLE ROW LEVEL SECURITY;

-- Realtime 有効化
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_commands;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_sessions;

-- Storageバケット (Storage > New Bucket でも可)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('ai-command-images', 'ai-command-images', true)
-- ON CONFLICT DO NOTHING;
