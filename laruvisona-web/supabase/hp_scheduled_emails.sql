-- LARU HP scheduled email delivery ledger.
-- Apply after schema.sql. All access is service-role only.

alter table public.profiles add column if not exists digest_enabled boolean not null default true;

create table if not exists public.hp_scheduled_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('weekly_digest','retention_day1','retention_day7','retention_day25')),
  period_key text not null check (char_length(period_key) between 1 and 32),
  status text not null default 'pending' check (status in ('pending','claimed','sent','failed')),
  attempts integer not null default 0 check (attempts between 0 and 5),
  claim_token uuid,
  claimed_until timestamptz,
  provider_id text,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, kind, period_key),
  check ((status = 'claimed') = (claim_token is not null and claimed_until is not null)),
  check ((status = 'sent') = (sent_at is not null))
);

create index if not exists hp_scheduled_email_due_idx
  on public.hp_scheduled_email_deliveries (status, claimed_until, attempts)
  where status <> 'sent' and attempts < 5;

alter table public.hp_scheduled_email_deliveries enable row level security;
revoke all on public.hp_scheduled_email_deliveries from public, anon, authenticated;
grant select, insert, update on public.hp_scheduled_email_deliveries to service_role;

create or replace function public.hp_claim_scheduled_email(
  p_profile_id uuid,
  p_kind text,
  p_period_key text
) returns table(delivery_id uuid, claim_token uuid, attempts integer)
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_token uuid := gen_random_uuid();
begin
  if p_kind not in ('weekly_digest','retention_day1','retention_day7','retention_day25')
     or p_period_key is null or char_length(p_period_key) not between 1 and 32 then
    raise exception 'invalid scheduled email key';
  end if;

  insert into public.hp_scheduled_email_deliveries(profile_id, kind, period_key)
  values (p_profile_id, p_kind, p_period_key)
  on conflict (profile_id, kind, period_key) do nothing;

  update public.hp_scheduled_email_deliveries d
  set status = 'claimed', claim_token = v_token, claimed_until = now() + interval '10 minutes',
      attempts = d.attempts + 1, last_error = null, updated_at = now()
  where d.profile_id = p_profile_id and d.kind = p_kind and d.period_key = p_period_key
    and d.attempts < 5 and d.status <> 'sent'
    and (d.status in ('pending','failed') or (d.status = 'claimed' and d.claimed_until <= now()))
  returning d.id into v_id;

  if v_id is null then return; end if;
  return query select v_id, v_token, d.attempts
    from public.hp_scheduled_email_deliveries d where d.id = v_id;
end;
$$;

create or replace function public.hp_finish_scheduled_email(
  p_delivery_id uuid,
  p_claim_token uuid,
  p_success boolean,
  p_provider_id text default null,
  p_error text default null
) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_updated integer;
begin
  update public.hp_scheduled_email_deliveries
  set status = case when p_success then 'sent' else 'failed' end,
      provider_id = case when p_success then left(p_provider_id, 255) else provider_id end,
      last_error = case when p_success then null else left(coalesce(p_error, 'send failed'), 1000) end,
      sent_at = case when p_success then now() else null end,
      claim_token = null, claimed_until = null, updated_at = now()
  where id = p_delivery_id and status = 'claimed' and claim_token = p_claim_token;
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

revoke all on function public.hp_claim_scheduled_email(uuid,text,text) from public, anon, authenticated;
revoke all on function public.hp_finish_scheduled_email(uuid,uuid,boolean,text,text) from public, anon, authenticated;
grant execute on function public.hp_claim_scheduled_email(uuid,text,text) to service_role;
grant execute on function public.hp_finish_scheduled_email(uuid,uuid,boolean,text,text) to service_role;
