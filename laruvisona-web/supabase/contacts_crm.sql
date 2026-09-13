-- 問い合わせ管理で使う列と、所有者による更新・削除権限。
-- 既存の問い合わせを保持したまま繰り返し適用できる。

alter table public.contacts add column if not exists extra_fields jsonb not null default '{}'::jsonb;
alter table public.contacts add column if not exists crm_status text not null default 'new';
alter table public.contacts add column if not exists crm_tags text[] not null default '{}'::text[];
alter table public.contacts add column if not exists crm_note text;
alter table public.contacts add column if not exists crm_followup_at timestamptz;

alter table public.contacts drop constraint if exists contacts_crm_status_check;
alter table public.contacts add constraint contacts_crm_status_check
  check (crm_status in ('new', 'in_progress', 'done', 'lost'));

drop policy if exists "Users update own contacts" on public.contacts;
create policy "Users update own contacts" on public.contacts
  for update to authenticated
  using (site_id in (select id from public.sites where user_id = auth.uid()))
  with check (site_id in (select id from public.sites where user_id = auth.uid()));

drop policy if exists "Users delete own contacts" on public.contacts;
create policy "Users delete own contacts" on public.contacts
  for delete to authenticated
  using (site_id in (select id from public.sites where user_id = auth.uid()));

revoke insert on public.contacts from anon, authenticated;
grant select, update, delete on public.contacts to authenticated;

create index if not exists contacts_owner_work_idx
  on public.contacts (site_id, crm_status, created_at desc);
