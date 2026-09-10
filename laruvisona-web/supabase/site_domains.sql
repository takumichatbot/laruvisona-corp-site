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
    -- alias: このサイトの別名。所有は確認できていて、配信側（Render等）が
    --        主な公開URLへ転送しているホスト。主URLにはできないが、
    --        転送元として画面に出す。
    check (status in ('pending_ownership','pending_dns','ssl_pending','connected','failed','legacy','release_pending','alias')),

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
  -- 外部登録を「呼ぶ直前」に立てる印。DB保存前に落ちても、
  -- こちらの都合で作った登録だと分かるようにするため（後始末の認可に使う）。
  render_register_started_at timestamptz,
  release_requested_at timestamptz,
  -- 解除を開始した時点で「こちらの都合で作った外部登録がある」と判断したかどうか。
  -- 解除に入ると status が release_pending に変わって legacy 等の根拠が消えるため、
  -- その瞬間の判断を残しておく（再試行しても判断がぶれない）。
  external_registration_owned boolean,
  -- 進行中の解除の識別子と占有期限。
  -- 同じホストに対する解除要求を1つに集約し、古い要求が
  -- 新しい世代の外部登録を消しに行かないようにする。
  release_operation_id uuid,
  release_lease_until timestamptz,
  -- alias のとき、どのホストへ転送されているか（同じサイトの確認済みホスト）
  redirects_to text,

  -- 処理の世代。所有確認トークンとは別物。
  --   verification_token … 利用者がDNSに置く値。行を作り直さない限り変わらない
  --   operation_epoch    … 解除を開始するたびに進む。進んだ時点で、
  --                        それより前に始まった検証の結果は適用できなくなる
  -- TXTトークンだけでは同じ行の「処理の世代」を区別できず、
  -- 解除の途中に古い検証が割り込んで上書きできてしまった。
  operation_epoch bigint not null default 1,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 同じホストを2つのサイトが同時に主張できないようにする。
-- アプリ側のチェックだけでは同時リクエストで抜けるため、DBの制約で押さえる。
-- 既存インストールへの追加（初回適用時は上のcreate tableで作られている）
alter table public.site_domains add column if not exists operation_epoch bigint not null default 1;
alter table public.site_domains add column if not exists render_register_started_at timestamptz;
alter table public.site_domains add column if not exists external_registration_owned boolean;
alter table public.site_domains add column if not exists release_operation_id uuid;
alter table public.site_domains add column if not exists release_lease_until timestamptz;
alter table public.site_domains add column if not exists redirects_to text;
-- 既存インストールの制約に alias を足す
alter table public.site_domains drop constraint if exists site_domains_status_check;
alter table public.site_domains add constraint site_domains_status_check
  check (status in ('pending_ownership','pending_dns','ssl_pending','connected','failed','legacy','release_pending','alias'));

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
  -- どの行・どの世代・どの解除処理の積み残しかを残す。
  -- ホスト名だけだと、同じホストが別サイトに登録し直されたときに
  -- 新しい割当を消してしまう。
  verification_token text,
  operation_epoch bigint,
  release_operation_id uuid,
  external_registration_owned boolean,
  /** 'release'（解除の積み残し） / 'orphan_registration'（登録できたが記録できなかった） */
  kind text not null default 'release',
  requested_at timestamptz not null default now(),
  attempts int not null default 0,
  last_error text,
  resolved_at timestamptz
);
alter table public.domain_release_queue add column if not exists verification_token text;
alter table public.domain_release_queue add column if not exists operation_epoch bigint;
alter table public.domain_release_queue add column if not exists release_operation_id uuid;
alter table public.domain_release_queue add column if not exists external_registration_owned boolean;
alter table public.domain_release_queue add column if not exists kind text not null default 'release';
alter table public.domain_release_queue enable row level security;
revoke all on public.domain_release_queue from authenticated, anon;

create or replace function public.site_domains_enqueue_release()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- finish_release から消すときはフラグが立っているので積まない
  if coalesce(current_setting('laruhp.release_done', true), '') = '1' then
    return old;
  end if;
  -- 外部に何かを作った可能性がある行は、消える前に積む。
  -- render_register_started_at（登録を呼んだ記録）を見ていなかったため、
  -- 「登録は通ったがIDを保存する前にサイトごと削除された」行が
  -- 追跡できずに消えていた。
  if old.render_domain_id is not null
     or old.render_register_started_at is not null
     or coalesce(old.external_registration_owned, false)
     or old.status in ('connected', 'legacy', 'release_pending', 'ssl_pending') then
    insert into public.domain_release_queue (
      site_id, host, render_domain_id, verification_token, operation_epoch,
      release_operation_id, external_registration_owned, kind)
    values (
      old.site_id, old.host, old.render_domain_id, old.verification_token, old.operation_epoch,
      old.release_operation_id, old.external_registration_owned, 'release');
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
--
-- 共通の約束:
--   * 対象行を for update でロックしてから判断する
--   * verification_token（行の同一性）と operation_epoch（処理の世代）の
--     両方が一致しないと適用しない
--   * 「いまの状態から遷移してよいか」もDB内で確認する。
--     関数の外で読んだ状態を根拠にしない

-- 外部登録を呼ぶ直前に印を付ける。
-- Renderへの登録が成功したのにDB保存前に落ちた場合でも、
-- 「こちらの都合で作った登録」であることが後から分かるようにする。
create or replace function public.laruhp_domain_mark_register_started(
  p_site_id uuid,
  p_host text,
  p_fencing_token text,
  p_epoch bigint
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_row public.site_domains%rowtype;
begin
  select * into v_row from public.site_domains
   where site_id = p_site_id and host = p_host for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'gone');
  end if;
  -- epoch は行を作り直すと 1 に戻りうるので、行の同一性（token）も見る
  if v_row.verification_token is distinct from p_fencing_token
     or v_row.operation_epoch is distinct from p_epoch then
    return jsonb_build_object('ok', false, 'reason', 'stale');
  end if;
  if v_row.status = 'release_pending' then
    return jsonb_build_object('ok', false, 'reason', 'releasing');
  end if;

  update public.site_domains
     set render_register_started_at = coalesce(render_register_started_at, now())
   where id = v_row.id;
  return jsonb_build_object('ok', true);
end;
$$;

-- 検証結果の確定。
create or replace function public.laruhp_domain_apply_check(
  p_site_id uuid,
  p_host text,
  p_fencing_token text,
  p_epoch bigint,
  p_status text,
  p_render_domain_id text,
  p_last_error text,
  p_make_primary boolean,
  p_redirects_to text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_row public.site_domains%rowtype;
  v_switched boolean := false;
  v_now timestamptz := now();
begin
  select * into v_row from public.site_domains
   where site_id = p_site_id and host = p_host
   for update;

  if not found
     or v_row.verification_token is distinct from p_fencing_token
     or v_row.operation_epoch is distinct from p_epoch then
    return jsonb_build_object('ok', false, 'reason', 'gone');
  end if;

  -- 解除が始まっている行に、古い検証結果を書き戻さない
  if v_row.status = 'release_pending' then
    return jsonb_build_object('ok', false, 'reason', 'releasing');
  end if;

  update public.site_domains set
    status = p_status,
    render_domain_id = coalesce(p_render_domain_id, render_domain_id),
    render_registered_at = case
      when p_render_domain_id is not null and render_registered_at is null then v_now
      else render_registered_at end,
    last_error = p_last_error,
    last_checked_at = v_now,
    -- 別名でなくなったら転送先も消す
    redirects_to = case when p_status = 'alias' then p_redirects_to else null end,
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

  -- 主URLの自動採用は「いまも未設定」のときだけ。
  -- 検証を始めた時点で未設定でも、その間に利用者が明示的に選んでいれば
  -- そちらを尊重する（上書きしない）。
  if p_make_primary and p_status in ('connected', 'legacy') then
    update public.sites set custom_domain = p_host
     where id = p_site_id and custom_domain is null;
    v_switched := found;
  end if;

  return jsonb_build_object('ok', true, 'switched', v_switched);
end;
$$;

-- 主な公開URLの明示的な切替。旧ドメインを解除せずに切り替えられる。
create or replace function public.laruhp_domain_set_primary(
  p_site_id uuid,
  p_host text,
  p_fencing_token text,
  p_epoch bigint
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_row public.site_domains%rowtype;
begin
  select * into v_row from public.site_domains
   where site_id = p_site_id and host = p_host
   for update;

  if not found
     or v_row.verification_token is distinct from p_fencing_token
     or v_row.operation_epoch is distinct from p_epoch then
    return jsonb_build_object('ok', false, 'reason', 'gone');
  end if;
  -- alias（転送されるホスト）は主URLにできない。
  -- 主URLにすると、そのホスト自身へ転送し続ける輪ができる。
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

-- 解除の開始。
-- ここで operation_epoch を進めるので、進行中だった検証の結果は
-- もう適用できなくなる（順序Aの上書きを止める）。
create or replace function public.laruhp_domain_begin_release(
  p_site_id uuid,
  p_host text,
  p_lease_seconds int default 120
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_row public.site_domains%rowtype;
begin
  select * into v_row from public.site_domains
   where site_id = p_site_id and host = p_host
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'gone');
  end if;

  -- すでに別の解除処理が動いている間は、新しい処理を始めない。
  -- 並行して外部へ出ていくと、遅れた側が新しい世代の登録を消しにいく。
  if v_row.status = 'release_pending'
     and v_row.release_lease_until is not null
     and v_row.release_lease_until > now() then
    return jsonb_build_object('ok', false, 'reason', 'in_progress',
                              'row', to_jsonb(v_row));
  end if;

  update public.sites set custom_domain = null
   where id = p_site_id and custom_domain = p_host;

  update public.site_domains set
    status = 'release_pending',
    operation_epoch = operation_epoch + 1,
    release_requested_at = coalesce(release_requested_at, now()),
    release_operation_id = gen_random_uuid(),
    release_lease_until = now() + make_interval(secs => p_lease_seconds),
    -- 解除前の行から判断して固定する。status はこの更新で release_pending に
    -- 変わるので、legacy だったことを後から判断できなくなるため。
    external_registration_owned = coalesce(
      external_registration_owned,
      v_row.render_domain_id is not null
        or v_row.render_register_started_at is not null
        or v_row.status = 'legacy'
    )
   where id = v_row.id
   returning * into v_row;

  return jsonb_build_object('ok', true, 'row', to_jsonb(v_row));
end;
$$;

-- 外部削除の対象IDを、この解除処理に固定する。
-- legacy など行にIDが無い場合は、外部一覧から引いた1件をここで確定させる。
-- 固定できなければ（行が消えた・世代が進んだ・別処理になった）外部は触らない。
create or replace function public.laruhp_domain_pin_release_target(
  p_site_id uuid,
  p_host text,
  p_epoch bigint,
  p_operation_id uuid,
  p_render_domain_id text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_row public.site_domains%rowtype;
begin
  select * into v_row from public.site_domains
   where site_id = p_site_id and host = p_host for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'gone');
  end if;
  if v_row.operation_epoch is distinct from p_epoch
     or v_row.release_operation_id is distinct from p_operation_id
     or v_row.status <> 'release_pending' then
    return jsonb_build_object('ok', false, 'reason', 'stale');
  end if;

  update public.site_domains
     set render_domain_id = coalesce(render_domain_id, p_render_domain_id)
   where id = v_row.id
   returning * into v_row;

  return jsonb_build_object('ok', true, 'render_domain_id', v_row.render_domain_id);
end;
$$;

-- 外部削除を実行してよいかを、直前にもう一度確かめて占有を延長する。
-- 遅れた解除要求が、別の処理で作り直されたホストを消しに行かないようにする。
create or replace function public.laruhp_domain_claim_release(
  p_site_id uuid,
  p_host text,
  p_epoch bigint,
  p_operation_id uuid,
  p_lease_seconds int default 120
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_row public.site_domains%rowtype;
begin
  select * into v_row from public.site_domains
   where site_id = p_site_id and host = p_host for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'gone');
  end if;
  if v_row.operation_epoch is distinct from p_epoch
     or v_row.release_operation_id is distinct from p_operation_id
     or v_row.status <> 'release_pending' then
    return jsonb_build_object('ok', false, 'reason', 'stale');
  end if;

  update public.site_domains
     set release_lease_until = now() + make_interval(secs => p_lease_seconds)
   where id = v_row.id;
  return jsonb_build_object('ok', true, 'render_domain_id', v_row.render_domain_id);
end;
$$;

-- 外部登録は成功したが、その記録をDBへ残せなかった分を積む。
-- 解除が先に完了して行が消えている場合もあるので、行に依存しない。
create or replace function public.laruhp_domain_enqueue_orphan_registration(
  p_site_id uuid,
  p_host text,
  p_render_domain_id text,
  p_fencing_token text,
  p_epoch bigint,
  p_message text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into public.domain_release_queue (
    site_id, host, render_domain_id, verification_token, operation_epoch,
    external_registration_owned, kind, last_error)
  values (p_site_id, p_host, p_render_domain_id, p_fencing_token, p_epoch, true,
          'orphan_registration', p_message)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- 外部解除まで終わったので記録を消す。ここからの削除はキューに積まない。
create or replace function public.laruhp_domain_finish_release(
  p_site_id uuid,
  p_host text,
  p_fencing_token text,
  p_epoch bigint,
  -- 外部側の後始末が「実際に確認できた」か。
  -- 削除できた、または確実に存在しないと確認できた場合だけ true。
  -- 「照会したら見つからなかった」だけでは true にしない
  --（登録が進行中で、あとから出来上がることがある）。
  p_external_settled boolean
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_row public.site_domains%rowtype;
begin
  select * into v_row from public.site_domains
   where site_id = p_site_id and host = p_host
   for update;
  if not found
     or v_row.verification_token is distinct from p_fencing_token
     or v_row.operation_epoch is distinct from p_epoch then
    return jsonb_build_object('ok', false, 'reason', 'gone');
  end if;
  if v_row.status <> 'release_pending' then
    return jsonb_build_object('ok', false, 'reason', 'not_releasing');
  end if;

  -- 外部の後始末が確認できていない行を消すときは、削除の記録を必ず残す。
  -- （フラグを立てないので BEFORE DELETE トリガがキューへ積む）
  if p_external_settled then
    perform set_config('laruhp.release_done', '1', true);
  end if;
  delete from public.site_domains where id = v_row.id;
  perform set_config('laruhp.release_done', '', true);

  -- キューの完了は、ここではしない。
  -- 以前は host 一致で一括 resolved にしていたため、
  -- 別処理が積んだ未回収の登録（orphan_registration など）まで
  -- 消えたことにしていた。完了は
  -- laruhp_domain_resolve_queue_entry で1件ずつ行う。

  return jsonb_build_object('ok', true, 'external_settled', p_external_settled);
end;
$$;

-- キューの1件を完了にする。
-- 実際に削除できた／確実に存在しないと確認できた外部IDだけを対象にする。
-- ホスト名だけで一括処理しない。
create or replace function public.laruhp_domain_resolve_queue_entry(
  p_id uuid,
  p_note text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  update public.domain_release_queue
     set resolved_at = now(),
         last_error = coalesce(p_note, last_error),
         attempts = attempts + 1
   where id = p_id and resolved_at is null;
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', v_n > 0);
end;
$$;

-- そのホスト・その申請に紐づく未処理のキューを取り出す（回収処理用）。
create or replace function public.laruhp_domain_pending_queue(
  p_host text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  select coalesce(jsonb_agg(to_jsonb(q)), '[]'::jsonb) into v
    from public.domain_release_queue q
   where q.host = p_host and q.resolved_at is null;
  return jsonb_build_object('ok', true, 'entries', v);
end;
$$;

-- 解除に失敗した記録。
-- 世代と現在状態を見るので、遅れて届いた古い解除失敗が、
-- 作り直された新しい申請を release_pending にすることはない（順序C）。
create or replace function public.laruhp_domain_mark_release_failed(
  p_site_id uuid,
  p_host text,
  p_epoch bigint,
  p_message text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_row public.site_domains%rowtype;
begin
  select * into v_row from public.site_domains
   where site_id = p_site_id and host = p_host
   for update;
  if not found or v_row.operation_epoch is distinct from p_epoch then
    return jsonb_build_object('ok', false, 'reason', 'stale');
  end if;
  if v_row.status <> 'release_pending' then
    return jsonb_build_object('ok', false, 'reason', 'not_releasing');
  end if;

  update public.site_domains
     set last_error = p_message, last_checked_at = now()
   where id = v_row.id;

  insert into public.domain_release_queue (site_id, host, render_domain_id, last_error, attempts)
  select v_row.site_id, v_row.host, v_row.render_domain_id, p_message, 1
   where not exists (
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
    'laruhp_domain_apply_check(uuid,text,text,bigint,text,text,text,boolean,text)',
    'laruhp_domain_set_primary(uuid,text,text,bigint)',
    'laruhp_domain_finish_release(uuid,text,text,bigint,boolean)',
    'laruhp_domain_resolve_queue_entry(uuid,text)',
    'laruhp_domain_pending_queue(text)',
    'laruhp_domain_mark_release_failed(uuid,text,bigint,text)',
    'laruhp_domain_mark_register_started(uuid,text,text,bigint)',
    'laruhp_domain_begin_release(uuid,text,int)',
    'laruhp_domain_pin_release_target(uuid,text,bigint,uuid,text)',
    'laruhp_domain_claim_release(uuid,text,bigint,uuid,int)',
    'laruhp_domain_enqueue_orphan_registration(uuid,text,text,text,bigint,text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
  -- 旧シグネチャが残っていると authenticated から呼べてしまうので落とす
  execute 'drop function if exists public.laruhp_domain_apply_check(uuid,text,text,text,text,text,boolean)';
  execute 'drop function if exists public.laruhp_domain_apply_check(uuid,text,text,bigint,text,text,text,boolean)';
  execute 'drop function if exists public.laruhp_domain_set_primary(uuid,text,text)';
  execute 'drop function if exists public.laruhp_domain_finish_release(uuid,text,text)';
  execute 'drop function if exists public.laruhp_domain_mark_release_failed(uuid,text,text)';
  execute 'drop function if exists public.laruhp_domain_mark_register_started(uuid,text,bigint)';
  execute 'drop function if exists public.laruhp_domain_begin_release(uuid,text)';
  execute 'drop function if exists public.laruhp_domain_finish_release(uuid,text,text,bigint)';
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
