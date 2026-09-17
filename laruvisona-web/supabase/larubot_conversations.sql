-- LARUbot から送られてくる会話ログの置き場。
--
-- 2026-09-17: コードは4か所でこのテーブルを使っているのに、DBに存在しなかった。
--   ・POST /api/larubot/conversations（LARUbot → こちら）は必ず 503
--   ・「LARUbotの会話ログ」画面は常に空
--   ・AIのチャット分析（/api/ai/chat-analysis）とリードスコア（/api/ai/lead-score）は
--     材料が読めないので動かない
-- どれも「押しても何も起きない」形で失敗していた。
--
-- Supabase の SQL エディタでそのまま実行できる。2回流しても壊れない。

create table if not exists public.larubot_conversations (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  -- LARUbot 側の会話の単位。同じ会話には同じ値が来る前提で upsert する。
  -- null 同士は衝突しないので、null のまま送られ続けると同じ会話が積み重なる。
  -- （LARUbot 側へ「必須にしてほしい」と依頼済み）
  session_id text,
  messages jsonb not null,
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- upsert の onConflict: 'site_id,session_id' が効くための一意制約。
create unique index if not exists larubot_conversations_site_session_idx
  on public.larubot_conversations (site_id, session_id);

create index if not exists larubot_conversations_site_updated_idx
  on public.larubot_conversations (site_id, updated_at desc);

alter table public.larubot_conversations enable row level security;

-- 読み書きはサーバー（service_role）だけ。ブラウザからは触らせない。
-- 会話の中身には、訪問者が書いた個人情報が入りうる。
revoke all on public.larubot_conversations from anon, authenticated;
