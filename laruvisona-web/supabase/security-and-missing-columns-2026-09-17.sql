-- 2026-09-17 の点検で見つかった3点を直す。
-- Supabase の SQL エディタでそのまま実行できる。2回流しても壊れない。
--
--   (1) コードが使っているのに、DBに存在しない列がある
--   (2) 公開サイトの全列を、匿名の誰でも読めてしまう
--   (3) 課金・権限の列を、本人のブラウザから書き換えられてしまう

-- ─────────────────────────────────────────────────────────────
-- (1) 足りない列
--
-- 列が無いと、PostgREST はその列を含む問い合わせを丸ごと失敗させる。
-- そのため次の機能は「押しても何も起きない」状態だった:
--   ・Googleマップ連携の保存（profiles.gmb_place_id）
--   ・Instagram連携（profiles.instagram_username / instagram_access_token）
--   ・エージェンシーのブランド設定（profiles.agency_brand_name / logo / accent）
--   ・AIサイト診断（sites.page_title / meta_description を select していた → コード側で外した）
--   ・リードスコア（sites.lead_scores）
-- ─────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists gmb_place_id text,
  add column if not exists instagram_username text,
  add column if not exists instagram_access_token text,
  add column if not exists agency_brand_name text,
  add column if not exists agency_logo_url text,
  add column if not exists agency_accent text;

alter table public.sites
  add column if not exists lead_scores jsonb;

-- ─────────────────────────────────────────────────────────────
-- (2) 匿名に、公開サイトの全列を読ませない
--
-- 「公開サイトは誰でも見られる」ための select ポリシーが、列を限定せずに
-- 付いていた。anon キーはブラウザに配られる公開値なので、
--   GET /rest/v1/sites?published=eq.true&select=settings_json
-- だけで、全利用者の settings_json（LINEの通知トークン・通知先メール・
-- Webhook URL・閲覧パスワード・プレビュートークン）が読めてしまう。
--
-- 公開ページ（/hp/<slug>）と独自ドメインの引き当ては、どちらも
-- サーバー側が service_role で読んでいる（app/hp/[slug]/page.tsx, proxy.ts）。
-- 匿名の直接読み取りは、どこからも必要とされていない。
-- ─────────────────────────────────────────────────────────────
drop policy if exists "sites_select_published" on public.sites;
revoke all on public.sites from anon;

-- ─────────────────────────────────────────────────────────────
-- (3) 課金・権限の列は、サーバーだけが変えられるようにする
--
-- profiles の update ポリシーは「自分の行なら更新可」だけで、列の制限が無い。
-- 本人の JWT で
--   PATCH /rest/v1/profiles?id=eq.<自分> {"plan":"agency","subscription_status":"active"}
-- を送れば、支払わずに全機能が使え、管理者による停止も自分で解除できる。
--
-- sites 側には同じ趣旨の番人（laruhp_guard_site_publication）がすでにある。
-- 同じ形で profiles にも置く。列単位の grant ではなくトリガにするのは、
-- あとから列が増えたときに守り漏れが出ないようにするため。
-- ─────────────────────────────────────────────────────────────
create or replace function public.laruhp_guard_profile_billing()
returns trigger language plpgsql set search_path=public as $$
declare request_role text;
begin
  request_role := coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role','');
  if request_role in ('anon','authenticated') and (
    new.id is distinct from old.id
    or new.plan is distinct from old.plan
    or new.subscription_status is distinct from old.subscription_status
    or new.features is distinct from old.features
    or new.is_suspended is distinct from old.is_suspended
    or new.stripe_customer_id is distinct from old.stripe_customer_id
    or new.stripe_subscription_id is distinct from old.stripe_subscription_id
    or new.contract_starts_at is distinct from old.contract_starts_at
    or new.contract_ends_at is distinct from old.contract_ends_at
    or new.admin_notes is distinct from old.admin_notes
    or new.google_refresh_token is distinct from old.google_refresh_token
    or new.retention_emails_sent is distinct from old.retention_emails_sent
  ) then
    raise exception 'profile_billing_server_only';
  end if;
  return new;
end $$;

revoke all on function public.laruhp_guard_profile_billing() from public, anon, authenticated;

drop trigger if exists laruhp_guard_profile_billing_trg on public.profiles;
create trigger laruhp_guard_profile_billing_trg
  before update on public.profiles for each row
  execute function public.laruhp_guard_profile_billing();

-- 行の作成は、サインアップ時の handle_new_user（definer）だけが行う。
revoke insert, delete on public.profiles from anon, authenticated;
revoke all on public.profiles from anon;

-- ─────────────────────────────────────────────────────────────
-- 確認（実行後に、そのまま流して結果を見る）
-- ─────────────────────────────────────────────────────────────
-- select column_name from information_schema.columns
--   where table_schema='public' and table_name='profiles' and column_name like 'agency%';
-- select polname from pg_policies where tablename='sites';
-- select tgname from pg_trigger where tgrelid='public.profiles'::regclass and not tgisinternal;
