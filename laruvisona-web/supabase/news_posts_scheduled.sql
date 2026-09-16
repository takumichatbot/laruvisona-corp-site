-- 予約投稿。カレンダー画面（/laruHP/calendar）が「この日に出す」を保存するための列。
--
-- 2026-09-17 まで、カレンダーは scheduled_at という存在しない列と、存在しない
-- API（/api/posts）を相手にしていた。ドラッグすると予約できたように見えて、
-- 再読み込みで消えていた。
--
-- published_at では代用できない。下書きにも published_at が入る（default now()）ため、
-- 「日付が来たら公開する」を published_at で判断すると、公開するつもりのない下書きまで
-- 世に出てしまう。予約は専用の列で持つ。
--
-- Supabase の SQL エディタでそのまま実行できる。2回流しても壊れない。

alter table public.news_posts
  add column if not exists scheduled_at timestamptz;

comment on column public.news_posts.scheduled_at is
  '予約投稿の公開予定時刻。null は予約なし。公開されると null に戻り、published_at にその時刻が入る。';

-- 予約を拾うのは「まだ公開していない・予約がある」ものだけ。部分索引にしておく。
create index if not exists news_posts_scheduled_idx
  on public.news_posts (scheduled_at)
  where published = false and scheduled_at is not null;
