-- Retry durable scheduling events whose immediate email delivery did not complete.
begin;
alter table public.hp_booking_events add column if not exists notification_attempts integer not null default 0;
alter table public.hp_booking_events add column if not exists next_notification_at timestamptz not null default now();
alter table public.hp_booking_events add column if not exists notification_claim_token uuid;
alter table public.hp_booking_events add column if not exists notification_claimed_until timestamptz;
alter table public.hp_booking_events add column if not exists notification_last_error text;
do $$ begin
 if not exists(select 1 from pg_constraint where conrelid='public.hp_booking_events'::regclass and conname='hp_booking_events_notification_attempts') then
  alter table public.hp_booking_events add constraint hp_booking_events_notification_attempts check(notification_attempts between 0 and 5);
 end if;
 if not exists(select 1 from pg_constraint where conrelid='public.hp_booking_events'::regclass and conname='hp_booking_events_notification_lease') then
  alter table public.hp_booking_events add constraint hp_booking_events_notification_lease check((notification_claim_token is null)=(notification_claimed_until is null));
 end if;
end $$;
create index if not exists hp_booking_events_notification_due on public.hp_booking_events(next_notification_at,created_at) where notified=false;

create or replace function public.hp_schedule_claim_notifications(p_limit integer default 20)
returns table(site_id uuid,appointment_id uuid,revision integer,claim_token uuid)
language plpgsql security definer set search_path=public as $$
begin
 if p_limit<1 or p_limit>100 then raise exception 'invalid_limit'; end if;
 update hp_booking_events set notification_claim_token=null,notification_claimed_until=null,
   next_notification_at=now(),notification_last_error='stale_claim'
 where notified=false and notification_claimed_until<=now();
 return query
 with picked as (
   select e.id from hp_booking_events e
   where e.notified=false and e.notification_attempts<5 and e.next_notification_at<=now()
     and e.created_at>now()-interval '23 hours' and e.notification_claim_token is null
   order by e.next_notification_at,e.created_at for update of e skip locked limit p_limit
 ),claimed as (
   update hp_booking_events e set notification_attempts=e.notification_attempts+1,
     notification_claim_token=gen_random_uuid(),notification_claimed_until=now()+interval '10 minutes'
   from picked p where e.id=p.id returning e.*
 ) select c.site_id,c.appointment_id,c.revision,c.notification_claim_token from claimed c;
end $$;

create or replace function public.hp_schedule_finish_notification(
 p_site uuid,p_appointment uuid,p_revision integer,p_claim_token uuid,p_success boolean,p_error text default null
) returns boolean language plpgsql security definer set search_path=public as $$
declare changed integer;
begin
 update hp_booking_events set notification_claim_token=null,notification_claimed_until=null,
   next_notification_at=case when p_success or notification_attempts>=5 then next_notification_at
     else now()+make_interval(mins=>least(60,5*power(2,greatest(notification_attempts-1,0))::integer)) end,
   notification_last_error=case when p_success then null else left(coalesce(p_error,'delivery_failed'),500) end
 where site_id=p_site and appointment_id=p_appointment and revision=p_revision
   and notification_claim_token=p_claim_token and (not p_success or notified=true);
 get diagnostics changed=row_count;return changed=1;
end $$;

revoke all on function public.hp_schedule_claim_notifications(integer),public.hp_schedule_finish_notification(uuid,uuid,integer,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.hp_schedule_claim_notifications(integer),public.hp_schedule_finish_notification(uuid,uuid,integer,uuid,boolean,text) to service_role;
commit;
