-- ─────────────────────────────────────────────────────────────────────────────
-- news_posts: ブログ／お知らせ記事
--
-- 実行方法: Supabase ダッシュボード → SQL Editor → 貼り付けて Run
--
-- 設計:
--   - 読み書きはすべてサーバーAPI（service role）経由で行い、所有権はアプリ側で検証する
--   - そのため RLS の書き込みポリシーは置かない（service role は RLS をバイパス）
--   - 公開ページ用に「公開済み(published=true)のみ」を anon でも読めるポリシーを付与
--   - ⚠️ 以前ステージングで暫定追加した緩いポリシー
--        news_write_all (FOR ALL USING(true) WITH CHECK(true)) は
--        誰でも書き込み可能で危険なため、下部の DROP で必ず削除すること
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.news_posts (
  id uuid default gen_random_uuid() primary key,
  site_id uuid references public.sites(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  content text,
  category text,
  image_url text,
  published boolean not null default false,
  published_at timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists news_posts_site_idx on public.news_posts (site_id, published_at desc);

alter table public.news_posts enable row level security;

-- 既存の（暫定/緩い）ポリシーを掃除してから貼り直す
drop policy if exists news_owner on public.news_posts;
drop policy if exists news_select_all on public.news_posts;
drop policy if exists news_write_all on public.news_posts;          -- ← 危険な公開書き込みを削除
drop policy if exists news_posts_select_published on public.news_posts;
drop policy if exists news_posts_select_own on public.news_posts;

-- 公開済み記事は誰でも閲覧可（公開HPのnews/記事ページ用。実際の読み出しはservice role経由だが保険）
create policy news_posts_select_published on public.news_posts
  for select using (published = true);

-- オーナーは自分の記事（下書き含む）を閲覧可
create policy news_posts_select_own on public.news_posts
  for select using (auth.uid() = user_id);

-- INSERT / UPDATE / DELETE のポリシーは置かない（サーバーの service role 経由のみ許可）
