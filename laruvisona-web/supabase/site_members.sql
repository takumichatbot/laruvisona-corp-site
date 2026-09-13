-- LARUbotの会話履歴を共同で閲覧するメンバー。
-- サイト編集権限とは別。全操作は所有者確認済みのサーバーAPIを通す。
create table if not exists public.site_members (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  invited_email text not null,
  role text not null default 'conversation_viewer',
  status text not null default 'pending',
  invite_token text,
  invite_expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.site_members add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.site_members add column if not exists role text not null default 'conversation_viewer';
alter table public.site_members add column if not exists status text not null default 'pending';
alter table public.site_members add column if not exists invite_token text;
alter table public.site_members add column if not exists invite_expires_at timestamptz;
alter table public.site_members add column if not exists created_at timestamptz not null default now();

update public.site_members set invited_email=lower(trim(invited_email));
update public.site_members set role='conversation_viewer' where role is distinct from 'conversation_viewer';
update public.site_members set status='pending' where status not in ('pending','active');
-- 旧リンクには期限情報が無いため、移行時点で失効させて所有者から再送する。
update public.site_members set invite_expires_at=now() where status='pending' and invite_expires_at is null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='site_members_role_check' and conrelid='public.site_members'::regclass) then
    alter table public.site_members add constraint site_members_role_check check (role='conversation_viewer');
  end if;
  if not exists (select 1 from pg_constraint where conname='site_members_status_check' and conrelid='public.site_members'::regclass) then
    alter table public.site_members add constraint site_members_status_check check (status in ('pending','active'));
  end if;
end $$;

create unique index if not exists site_members_site_email_uidx on public.site_members(site_id,invited_email);
create unique index if not exists site_members_invite_token_uidx on public.site_members(invite_token) where invite_token is not null;
create index if not exists site_members_user_idx on public.site_members(user_id,site_id) where status='active';

alter table public.site_members enable row level security;
revoke all on public.site_members from anon, authenticated;
grant all on public.site_members to service_role;
