-- LARU HP ニュースレターの送信履歴と配信追跡。
alter table public.newsletter_subscribers enable row level security;
revoke all on public.newsletter_subscribers from anon, authenticated;
grant select, update on public.newsletter_subscribers to authenticated;

drop policy if exists "Users update own subscribers" on public.newsletter_subscribers;
create policy "Users update own subscribers" on public.newsletter_subscribers
  for update to authenticated
  using (site_id in (select id from public.sites where user_id=auth.uid()))
  with check (site_id in (select id from public.sites where user_id=auth.uid()));

create table if not exists public.newsletter_campaigns (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  variant text not null default 'A' check(variant in ('A','B')),
  subject text not null,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  open_count integer not null default 0,
  click_count integer not null default 0,
  created_at timestamptz not null default now(),
  unique(site_id,request_id,variant)
);
alter table public.newsletter_campaigns add column if not exists request_id uuid;
alter table public.newsletter_campaigns add column if not exists variant text not null default 'A';
alter table public.newsletter_campaigns add column if not exists failed_count integer not null default 0;
update public.newsletter_campaigns set request_id=gen_random_uuid() where request_id is null;
alter table public.newsletter_campaigns alter column request_id set not null;
create unique index if not exists newsletter_campaigns_request_variant_idx on public.newsletter_campaigns(site_id,request_id,variant);

create table if not exists public.newsletter_email_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.newsletter_campaigns(id) on delete cascade,
  resend_email_id text not null,
  recipient_email text not null,
  event_type text not null,
  created_at timestamptz not null default now()
);
alter table public.newsletter_email_events drop constraint if exists newsletter_email_events_resend_email_id_key;
create unique index if not exists newsletter_events_email_type_idx on public.newsletter_email_events(resend_email_id,event_type);

alter table public.newsletter_campaigns enable row level security;
alter table public.newsletter_email_events enable row level security;
drop policy if exists "Users see own campaigns" on public.newsletter_campaigns;
create policy "Users see own campaigns" on public.newsletter_campaigns for select to authenticated
  using(site_id in (select id from public.sites where user_id=auth.uid()));
drop policy if exists "Users see own email events" on public.newsletter_email_events;
create policy "Users see own email events" on public.newsletter_email_events for select to authenticated
  using(campaign_id in (select id from public.newsletter_campaigns where user_id=auth.uid()));
revoke all on public.newsletter_campaigns,public.newsletter_email_events from anon,authenticated;
grant select on public.newsletter_campaigns,public.newsletter_email_events to authenticated;
grant all on public.newsletter_subscribers,public.newsletter_campaigns,public.newsletter_email_events to service_role;
create index if not exists newsletter_campaigns_site_created_idx on public.newsletter_campaigns(site_id,created_at desc);
create index if not exists newsletter_events_campaign_idx on public.newsletter_email_events(campaign_id);

create or replace function public.laruhp_newsletter_set_paused(p_site uuid,p_owner uuid,p_paused boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_site public.sites%rowtype;
begin
  select * into v_site from public.sites where id=p_site and user_id=p_owner for update;
  if not found then raise exception 'site_not_found'; end if;
  update public.sites set settings_json=jsonb_set(coalesce(settings_json,'{}'::jsonb),'{newsletter_paused}',to_jsonb(p_paused),true) where id=p_site;
  return jsonb_build_object('ok',true,'paused',p_paused);
end $$;
revoke all on function public.laruhp_newsletter_set_paused(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.laruhp_newsletter_set_paused(uuid,uuid,boolean) to service_role;
