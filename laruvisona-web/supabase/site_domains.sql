-- 独自ドメインの所有確認と接続状態を保持するテーブル。
--
-- 【この設計にした理由】
-- これまで独自ドメインは sites.custom_domain の1カラムだけで、
-- 「保存された」ことと「接続が確認できた」ことが区別できなかった。
-- 保存した瞬間に配信ルーティング（proxy.ts）と決済の戻り先許可リスト
-- （lib/site-origin.ts）に載ってしまうため、未確認のドメインが
-- 信頼される状態だった。
--
-- そこで役割を分ける:
--   sites.custom_domain … 「いま実際に配信している正のホスト」。
--                          確認が取れた時だけ書き換える。
--   public.site_domains … 申請中も含めた全ホストと、その状態。
--
-- こうすると、by-domain のページ・RPC・site-origin など既存の読み取りは
-- 一切変更しなくても「未確認のドメインは配信先にならない」が成り立つ。
-- 新ドメインの確認中も、旧ドメインは custom_domain に残るので公開が続く。
--
-- 【適用について】
-- このSQLはまだ本番に適用していない。適用は齋藤の確認後。
-- 既存の custom_domain は status='legacy' で取り込み、既存顧客を止めない。

create table if not exists public.site_domains (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,

  -- punycode（ASCII）に正規化したホスト名。lib/domain.ts の normalizeDomain と同じ形。
  host text not null,

  status text not null default 'pending_ownership'
    check (status in ('pending_ownership','pending_dns','ssl_pending','connected','failed','legacy')),

  -- テナント固有の所有確認トークン。共有Aレコードへの一致とは別の証拠。
  verification_token text not null,

  ownership_verified_at timestamptz,
  dns_verified_at       timestamptz,
  ssl_ready_at          timestamptz,
  connected_at          timestamptz,

  last_checked_at timestamptz,
  last_error text,

  -- Render 側の登録結果。重複登録を避けるために id を持っておく。
  render_domain_id text,
  render_registered_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 同じホストを2つのサイトが同時に主張できないようにする。
-- アプリ側のチェックだけだと同時リクエストで抜けるため、DBの制約で押さえる。
create unique index if not exists site_domains_host_key on public.site_domains (host);
create index if not exists site_domains_site_idx on public.site_domains (site_id);

alter table public.site_domains enable row level security;

drop policy if exists "Users manage own site_domains" on public.site_domains;
create policy "Users manage own site_domains" on public.site_domains
  for all
  using (site_id in (select id from public.sites where user_id = auth.uid()))
  with check (site_id in (select id from public.sites where user_id = auth.uid()));

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

-- ── 既存データの取り込み ────────────────────────────────
-- いま custom_domain が入っているサイトは、すでに公開できている可能性が高い。
-- 一律に未確認へ戻すと既存顧客のサイトが止まるので、'legacy' として取り込む。
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

-- 確認用（適用後に実行して結果を控える）:
--   select status, count(*) from public.site_domains group by status;
--   select count(*) from public.sites where custom_domain is not null;
--   -- 上の2つの legacy 件数と custom_domain 件数が一致すること。
