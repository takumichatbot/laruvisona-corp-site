-- ============================================================================
-- AI司令室（運用テーブル）を一般ユーザーから遮断する
-- ----------------------------------------------------------------------------
-- 背景:
--   ai_sessions / ai_commands / watcher_heartbeat / watcher_health は
--   DISABLE ROW LEVEL SECURITY のまま作られており、Realtime publication にも
--   入っている。anon / authenticated にテーブル権限が残っている場合、
--   Supabase の REST/Realtime から直接、指示の投入・編集・実行結果の閲覧ができる。
--   ai_watcher は DB の指示を auto_approve 付きで実行するため、
--   これは「Nextの管理者チェックを迂回して任意コマンドを実行できる」経路になる。
--
-- この移行後のアクセス方法:
--   - 画面 → /api/ai-command/* （管理者セッションを検証し service role で読む）
--   - Watcher → service role キー（RLS をバイパスするため影響なし）
--   ブラウザから supabase-js で直接読む経路は使えなくなる。
--
-- 適用: Supabase SQL Editor で実行。
-- ============================================================================

-- 1) RLS を有効化（ポリシーを作らない＝ anon/authenticated からは0行）
ALTER TABLE public.ai_sessions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_commands       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watcher_heartbeat ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watcher_health    ENABLE ROW LEVEL SECURITY;

-- 2) テーブル権限そのものを剥奪（RLS の設定ミスに備えた二重の防御）
REVOKE ALL ON public.ai_sessions       FROM anon, authenticated;
REVOKE ALL ON public.ai_commands       FROM anon, authenticated;
REVOKE ALL ON public.watcher_heartbeat FROM anon, authenticated;
REVOKE ALL ON public.watcher_health    FROM anon, authenticated;

-- 3) Realtime 配信から外す（RLS 無しで流れ続けるのを防ぐ）
ALTER PUBLICATION supabase_realtime DROP TABLE public.ai_commands;
ALTER PUBLICATION supabase_realtime DROP TABLE public.ai_sessions;
ALTER PUBLICATION supabase_realtime DROP TABLE public.watcher_heartbeat;
ALTER PUBLICATION supabase_realtime DROP TABLE public.watcher_health;

-- 4) 自動承認を既定 false にする（承認は明示的な操作に限る）
ALTER TABLE public.ai_commands ALTER COLUMN auto_approve SET DEFAULT false;

-- 5) 確認クエリ（適用後に流して rowsecurity = true / 権限が空であることを見る）
-- SELECT relname, relrowsecurity FROM pg_class
--   WHERE relname IN ('ai_sessions','ai_commands','watcher_heartbeat','watcher_health');
-- SELECT table_name, grantee, privilege_type FROM information_schema.role_table_grants
--   WHERE table_name IN ('ai_sessions','ai_commands','watcher_heartbeat','watcher_health')
--     AND grantee IN ('anon','authenticated');
