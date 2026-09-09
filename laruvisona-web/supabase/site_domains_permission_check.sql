-- site_domains の権限を、隔離したSupabase/Postgres環境で確認するための手順。
--
-- メモリ上の偽物では実効権限を保証できないため、必ず本物のDBで実行する。
-- 本番では実行しない（テスト用のプロジェクトかローカルの supabase start で行う）。
--
-- 前提: supabase/schema.sql と supabase/site_domains.sql を適用済み。
--       テスト用のユーザーを2人（u1, u2）作り、u1 のサイトを1件用意しておく。
--
-- 実行方法: psql で1ブロックずつ実行し、期待どおりに失敗することを確認する。
--           「成功してしまった」場合は権限設計に穴がある。

-- ── 準備 ───────────────────────────────────────────────
-- :u1  = サイト所有者の auth.users.id
-- :u2  = 別ユーザーの auth.users.id
-- :s1  = u1 が持つ sites.id
-- :h1  = u1 が申請したホスト名（site_domains に1行ある状態にしておく）

-- authenticated として u1 で振る舞う
create or replace function public._as_user(p_uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;

-- ── 1. 検証結果を偽造できないこと ─────────────────────
-- 期待: すべて 0 行更新、または権限エラー
begin;
  select public._as_user(:'u1');
  update public.site_domains set status = 'connected' where host = :'h1';
  -- 期待: ERROR: permission denied for table site_domains
rollback;

begin;
  select public._as_user(:'u1');
  update public.site_domains set verification_token = 'forged' where host = :'h1';
  -- 期待: ERROR: permission denied
rollback;

begin;
  select public._as_user(:'u1');
  update public.site_domains set render_domain_id = 'rd_someone_else' where host = :'h1';
  -- 期待: ERROR: permission denied
rollback;

begin;
  select public._as_user(:'u1');
  insert into public.site_domains (site_id, host, status, verification_token)
  values (:'s1', 'forged.example', 'connected', 'x');
  -- 期待: ERROR: permission denied
rollback;

begin;
  select public._as_user(:'u1');
  delete from public.site_domains where host = :'h1';
  -- 期待: ERROR: permission denied
rollback;

-- ── 2. 配信ポインタを直接書けないこと ─────────────────
begin;
  select public._as_user(:'u1');
  update public.sites set custom_domain = 'forged.example' where id = :'s1';
  -- 期待: ERROR: custom_domain は直接変更できません
rollback;

begin;
  select public._as_user(:'u1');
  insert into public.sites (user_id, name, custom_domain) values (:'u1', 'x', 'forged.example');
  -- 期待: ERROR: custom_domain は直接設定できません
rollback;

-- 通常の編集は今までどおり通ること（ここが壊れていないかも必ず見る）
begin;
  select public._as_user(:'u1');
  update public.sites set name = '名前の変更テスト' where id = :'s1';
  -- 期待: UPDATE 1
rollback;

-- ── 3. 状態遷移の関数を直接呼べないこと ───────────────
begin;
  select public._as_user(:'u1');
  select public.laruhp_domain_apply_check(:'s1', :'h1', 'x', 1::bigint, 'connected', null, null, true);
  -- 期待: ERROR: permission denied for function laruhp_domain_apply_check
rollback;

begin;
  select public._as_user(:'u1');
  select public.laruhp_domain_set_primary(:'s1', :'h1', 'x', 1::bigint);
  -- 期待: ERROR: permission denied
rollback;

-- ── 4. 他人の行が見えないこと ─────────────────────────
begin;
  select public._as_user(:'u2');
  select count(*) from public.site_domains where host = :'h1';
  -- 期待: 0
rollback;

-- ── 5. 解除キューが一般ユーザーから見えないこと ───────
begin;
  select public._as_user(:'u2');
  select count(*) from public.domain_release_queue;
  -- 期待: ERROR: permission denied
rollback;

-- ── 6. 解除・登録開始の関数も直接呼べないこと ────────
begin;
  select public._as_user(:'u1');
  select public.laruhp_domain_begin_release(:'s1', :'h1');
  -- 期待: ERROR: permission denied
rollback;

begin;
  select public._as_user(:'u1');
  select public.laruhp_domain_mark_register_started(:'s1', :'h1', 1::bigint);
  -- 期待: ERROR: permission denied
rollback;

-- ── 後片付け ───────────────────────────────────────────
drop function if exists public._as_user(uuid);
