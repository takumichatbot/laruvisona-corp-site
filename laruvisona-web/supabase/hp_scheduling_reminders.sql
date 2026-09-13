-- Durable reminders for the opt-in scheduling engine. Safe to apply after hp_scheduling.sql.
begin;

create table if not exists public.hp_booking_reminders (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null,
  appointment_id uuid not null,
  appointment_revision integer not null check (appointment_revision > 0),
  kind text not null check (kind in ('24h','2h')),
  status text not null default 'pending' check (status in ('pending','sending','sent','failed','obsolete')),
  attempts integer not null default 0 check (attempts between 0 and 5),
  next_attempt_at timestamptz not null default now(),
  claimed_until timestamptz,
  claim_token uuid,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (site_id,appointment_id) references public.hp_appointments(site_id,id) on delete cascade,
  unique (appointment_id,appointment_revision,kind),
  check ((status='sending')=(claimed_until is not null and claim_token is not null))
);
create index if not exists hp_booking_reminders_due
  on public.hp_booking_reminders(next_attempt_at,created_at)
  where status in ('pending','failed','sending');

alter table public.hp_booking_reminders enable row level security;
revoke all on public.hp_booking_reminders from public,anon,authenticated;
grant all on public.hp_booking_reminders to service_role;

create or replace function public.hp_schedule_claim_reminders(p_limit integer default 20)
returns table(
  reminder_id uuid, claim_token uuid, kind text, site_id uuid, appointment_id uuid,
  appointment_revision integer, customer_name text, customer_email text,
  service_name text, staff_name text, starts_at timestamptz, site_name text
) language plpgsql security definer set search_path=public as $$
begin
  if p_limit < 1 or p_limit > 100 then raise exception 'invalid_limit'; end if;

  -- A cancellation or reschedule supersedes work that has not been delivered.
  update hp_booking_reminders r set status='obsolete',claimed_until=null,claim_token=null,updated_at=now()
  from hp_appointments a
  where a.site_id=r.site_id and a.id=r.appointment_id
    and r.status in ('pending','failed','sending')
    and (a.status<>'confirmed' or a.revision<>r.appointment_revision or a.starts_at<=now());

  -- A worker may disappear after claiming. Return its lease to the finite retry queue.
  update hp_booking_reminders set status='failed',claimed_until=null,claim_token=null,
    next_attempt_at=now(),last_error='stale_claim',updated_at=now()
  where status='sending' and claimed_until<=now();

  -- Open-ended due ranges recover after a short cron outage. The 24h notice closes
  -- three hours before arrival so it never arrives beside the 2h notice.
  insert into hp_booking_reminders(site_id,appointment_id,appointment_revision,kind,next_attempt_at)
  select a.site_id,a.id,a.revision,'24h',a.starts_at-interval '24 hours'
  from hp_appointments a
  where a.status='confirmed' and a.starts_at>now()+interval '3 hours'
    and a.starts_at-interval '24 hours'<=now()
  on conflict (appointment_id,appointment_revision,kind) do nothing;
  insert into hp_booking_reminders(site_id,appointment_id,appointment_revision,kind,next_attempt_at)
  select a.site_id,a.id,a.revision,'2h',a.starts_at-interval '2 hours'
  from hp_appointments a
  where a.status='confirmed' and a.starts_at>now()
    and a.starts_at-interval '2 hours'<=now()
  on conflict (appointment_id,appointment_revision,kind) do nothing;

  return query
  with picked as (
    select r.id
    from hp_booking_reminders r
    join hp_appointments a on a.site_id=r.site_id and a.id=r.appointment_id
    where r.status in ('pending','failed') and r.attempts<5
      and r.next_attempt_at<=now() and a.status='confirmed'
      and a.revision=r.appointment_revision and a.starts_at>now()
    order by r.next_attempt_at,r.created_at
    for update of r skip locked
    limit p_limit
  ), claimed as (
    update hp_booking_reminders r set
      status='sending',attempts=r.attempts+1,claimed_until=now()+interval '10 minutes',
      claim_token=gen_random_uuid(),updated_at=now()
    from picked p where r.id=p.id
    returning r.*
  )
  select c.id,c.claim_token,c.kind,c.site_id,c.appointment_id,c.appointment_revision,
    a.name,a.email,a.service_name,a.staff_name,a.starts_at,s.name
  from claimed c
  join hp_appointments a on a.site_id=c.site_id and a.id=c.appointment_id
  join sites s on s.id=c.site_id;
end $$;

create or replace function public.hp_schedule_finish_reminder(
  p_id uuid,p_claim_token uuid,p_success boolean,p_error text default null
) returns boolean language plpgsql security definer set search_path=public as $$
declare changed integer;
begin
  update hp_booking_reminders set
    status=case when p_success then 'sent' else 'failed' end,
    sent_at=case when p_success then now() else sent_at end,
    next_attempt_at=case when p_success or attempts>=5 then next_attempt_at
      else now()+make_interval(mins=>least(60,5*(2^greatest(attempts-1,0))::integer)) end,
    last_error=case when p_success then null else left(coalesce(p_error,'delivery_failed'),500) end,
    claimed_until=null,claim_token=null,updated_at=now()
  where id=p_id and status='sending' and claim_token=p_claim_token;
  get diagnostics changed=row_count;
  return changed=1;
end $$;

revoke all on function public.hp_schedule_claim_reminders(integer),public.hp_schedule_finish_reminder(uuid,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.hp_schedule_claim_reminders(integer),public.hp_schedule_finish_reminder(uuid,uuid,boolean,text) to service_role;
commit;
