-- 独自ドメインの所有確認と接続状態。
--
-- 【設計】
-- sites.custom_domain … いま実際に配信している「主な公開URL」。
--                        確認が取れたホストしか入らない。
-- public.site_domains … 申請中も含めた全ホストと、その状態。
--
-- この分け方により、by-domain のページ・RPC・lib/site-origin.ts・proxy.ts を
-- 変更しなくても「未確認のドメインは配信先にならない」が成り立つ。
--
-- 【権限（重要）】
-- 一般ユーザー（authenticated）は site_domains を「読む」ことしかできない。
-- status・verification_token・render_domain_id は検証結果と外部管理IDなので、
-- ユーザーの資格情報でPostgRESTから直接書き換えられてはいけない。
-- 状態遷移はすべて security definer の関数で行い、その関数は service_role
-- だけが実行できる（アプリのサーバー側処理からしか呼べない）。
-- sites.custom_domain も、トリガでユーザーからの直接変更を拒否する。
--
-- 【適用】まだ本番未適用。適用は齋藤の確認後。
--       既存の custom_domain は status='legacy' で取り込み、既存顧客を止めない。

-- ── テーブル ──────────────────────────────────────────

create table if not exists public.site_domains (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  host text not null,
  status text not null default 'pending_ownership'
    check (status in ('pending_ownership','pending_dns','ssl_pending','connected','failed','legacy','release_pending')),

  -- テナント固有の所有確認トークン。
  -- 検証と削除が同時に走ったときの fencing token も兼ねる
  -- （行が消えて作り直されると値が変わるので、古い検証結果は適用されない）。
  verification_token text not null,

  ownership_verified_at timestamptz,
  dns_verified_at       timestamptz,
  ssl_ready_at          timestamptz,
  connected_at          timestamptz,

  last_checked_at timestamptz,
  last_error text,

  render_domain_id text,
  render_registered_at timestamptz,
  release_requested_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 同じホストを2つのサイトが同時に主張できないようにする。
-- アプリ側のチェックだけでは同時リクエストで抜けるため、DBの制約で押さえる。
create unique index if not exists site_domains_host_key on public.site_domains (host);
create index if not exists site_domains_site_idx on public.site_domains (site_id);

alter table public.site_domains enable row level security;

-- 読むのは本人のサイトの分だけ。書き込みポリシーは作らない
-- （＝ authenticated からの INSERT/UPDATE/DELETE はすべて拒否される）。
drop policy if exists "Users manage own site_domains" on public.site_domains;
drop policy if exists "Users read own site_domains" on public.site_domains;
create policy "Users read own site_domains" on public.site_domains
  for select
  using (site_id in (select id from public.sites where user_id = auth.uid()));

-- ポリシーだけでなくテーブル権限でも落としておく（多層で守る）
revoke insert, update, delete on public.site_domains from authenticated, anon;
grant select on public.site_domains to authenticated;

-- ── 外部解除の積み残しを失わないためのキュー ──────────
-- サイトごと削除されると site_domains は CASCADE で消えるが、
-- Render側の登録は残る。解除が必要な行は消える前にここへ写す。
create table if not exists public.domain_release_queue (
  id uuid primary key default gen_random_uuid(),
  site_id uuid,
  host text not null,
  render_domain_id text,
  requested_at timestamptz not null default now(),
  attempts int not null default 0,
  last_error text,
  resolved_at timestamptz
);
alter table public.domain_release_queue enable row level security;
revoke all on public.domain_release_queue from authenticated, anon;

create or replace function public.site_domains_enqueue_release()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- finish_release から消すときはフラグが立っているので積まない
  if coalesce(current_setting('laruhp.release_done', true), '') = '1' then
    return old;
  end if;
  if old.render_domain_id is not null
     or old.status in ('connected', 'legacy', 'release_pending', 'ssl_pending') then
    insert into public.domain_release_queue (site_id, host, render_domain_id)
    values (old.site_id, old.host, old.render_domain_id);
  end if;
  return old;
end;
$$;

drop trigger if exists site_domains_enqueue_release_trg on public.site_domains;
create trigger site_domains_enqueue_release_trg before delete on public.site_domains
  for each row execute function public.site_domains_enqueue_release();

create or replace function public.site_domains_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists site_domains_touch on public.site_domains;
create trigger site_domains_touch before update on public.site_domains
  for each row execute function public.site_domains_touch_updated_at();

-- ── sites.custom_domain の直接変更を拒否する ──────────
-- 既存の sites_update_own / sites_insert_own は列を区別しないため、
-- Next.js の PATCH を塞ぐだけでは「確認済みだけが入る」を保証できない。
create or replace function public.guard_sites_custom_domain()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_role text;
begin
  v_role := coalesce(current_setting('request.jwt.claims', true)::json ->> 'role', '');
  -- service_role（サーバー側処理）と、JWTの無い直接SQL（移行・運用）は通す
  if v_role in ('authenticated', 'anon') then
    if tg_op = 'INSERT' and new.custom_domain is not null then
      raise exception 'custom_domain は直接設定できません。独自ドメインの確認手順を使ってください';
    end if;
    if tg_op = 'UPDATE' and new.custom_domain is distinct from old.custom_domain then
      raise exception 'custom_domain は直接変更できません。独自ドメインの確認手順を使ってください';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_sites_custom_domain_trg on public.sites;
create trigger guard_sites_custom_domain_trg before insert or update on public.sites
  for each row execute function public.guard_sites_custom_domain();

-- ── 状態遷移（service_role からのみ実行できる）────────

-- 検証結果の確定。fencing token が一致し、行が残っている場合だけ適用する。
-- 主ドメインの採用も同じトランザクションで行う。
create or replace function public.laruhp_domain_apply_check(
  p_site_id uuid,
  p_host text,
  p_fencing_token text,
  p_status text,
  p_render_domain_id text,
  p_last_error text,
  p_make_primary boolean
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_row public.site_domains%rowtype;
  v_switched boolean := false;
  v_now timestamptz := now();
begin
  select * into v_row from public.site_domains
   where site_id = p_site_id and host = p_host
   for update;

  if not found or v_row.verification_token is distinct from p_fencing_token then
    return jsonb_build_object('ok', false, 'reason', 'gone');
  end if;

  update public.site_domains set
    status = p_status,
    render_domain_id = coalesce(p_render_domain_id, render_domain_id),
    render_registered_at = case
      when p_render_domain_id is not null and render_registered_at is null then v_now
      else render_registered_at end,
    last_error = p_last_error,
    last_checked_at = v_now,
    ownership_verified_at = case
      when p_status in ('pending_dns','ssl_pending','connected') then coalesce(ownership_verified_at, v_now)
      else ownership_verified_at end,
    dns_verified_at = case
      when p_status in ('ssl_pending','connected') then coalesce(dns_verified_at, v_now)
      else dns_verified_at end,
    ssl_ready_at = case
      when p_status = 'connected' then coalesce(ssl_ready_at, v_now)
      else ssl_ready_at end,
    connected_at = case
      when p_status = 'connected' then coalesce(connected_at, v_now)
      else connected_at end
  where id = v_row.id;

  if p_make_primary and p_status in ('connected', 'legacy') then
    update public.sites set custom_domain = p_host where id = p_site_id;
    v_switched := found;
  end if;

  return jsonb_build_object('ok', true, 'switched', v_switched);
end;
$$;

-- 主な公開URLの明示的な切替。旧ドメインを解除せずに切り替えられる。
create or replace function public.laruhp_domain_set_primary(
  p_site_id uuid,
  p_host text,
  p_fencing_token text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_row public.site_domains%rowtype;
begin
  select * into v_row from public.site_domains
   where site_id = p_site_id and host = p_host
   for update;

  if not found or v_row.verification_token is distinct from p_fencing_token then
    return jsonb_build_object('ok', false, 'reason', 'gone');
  end if;
  if v_row.status not in ('connected', 'legacy') then
    return jsonb_build_object('ok', false, 'reason', 'not_connected');
  end if;

  update public.sites set custom_domain = p_host where id = p_site_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'gone');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- 解除の開始。配信ポインタを先に外し、状態を release_pending にする。
create or replace function public.laruhp_domain_begin_release(
  p_site_id uuid,
  p_host text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_row public.site_domains%rowtype;
begin
  select * into v_row from public.site_domains
   where site_id = p_site_id and host = p_host
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'gone');
  end if;

  update public.sites set custom_domain = null
   where id = p_site_id and custom_domain = p_host;

  update public.site_domains set
    status = 'release_pending',
    release_requested_at = coalesce(release_requested_at, now())
   where id = v_row.id
   returning * into v_row;

  return jsonb_build_object('ok', true, 'row', to_jsonb(v_row));
end;
$$;

-- 外部解除まで終わったので記録を消す。ここからの削除はキューに積まない。
create or replace function public.laruhp_domain_finish_release(
  p_site_id uuid,
  p_host text,
  p_fencing_token text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_row public.site_domains%rowtype;
begin
  select * into v_row from public.site_domains
   where site_id = p_site_id and host = p_host
   for update;
  if not found or v_row.verification_token is distinct from p_fencing_token then
    return jsonb_build_object('ok', false, 'reason', 'gone');
  end if;

  perform set_config('laruhp.release_done', '1', true);
  delete from public.site_domains where id = v_row.id;
  perform set_config('laruhp.release_done', '', true);

  update public.domain_release_queue set resolved_at = now()
   where host = p_host and resolved_at is null;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.laruhp_domain_mark_release_failed(
  p_site_id uuid,
  p_host text,
  p_message text
) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  update public.site_domains
     set status = 'release_pending', last_error = p_message, last_checked_at = now()
   where site_id = p_site_id and host = p_host;

  insert into public.domain_release_queue (site_id, host, render_domain_id, last_error, attempts)
  select site_id, host, render_domain_id, p_message, 1
    from public.site_domains
   where site_id = p_site_id and host = p_host
     and not exists (
       select 1 from public.domain_release_queue q
        where q.host = p_host and q.resolved_at is null
     );

  return jsonb_build_object('ok', true);
end;
$$;

-- これらはサーバー側処理からしか呼べない
do $$
declare f text;
begin
  foreach f in array array[
    'laruhp_domain_apply_check(uuid,text,text,text,text,text,boolean)',
    'laruhp_domain_set_primary(uuid,text,text)',
    'laruhp_domain_begin_release(uuid,text)',
    'laruhp_domain_finish_release(uuid,text,text)',
    'laruhp_domain_mark_release_failed(uuid,text,text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end;
$$;

-- ── 既存データの取り込み ────────────────────────────────
-- いま custom_domain が入っているサイトは、すでに公開できている可能性が高い。
-- 一律に未確認へ戻すと既存顧客のサイトが止まるので 'legacy' として取り込む。
-- legacy は配信を続ける状態だが、画面では「要再確認」と表示する。
insert into public.site_domains (site_id, host, status, verification_token, connected_at)
select s.id,
       lower(s.custom_domain),
       'legacy',
       encode(gen_random_bytes(16), 'hex'),
       now()
from public.sites s
where s.custom_domain is not null
  and length(trim(s.custom_domain)) > 0
on conflict (host) do nothing;
