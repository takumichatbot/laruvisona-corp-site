-- Durable delivery state for reservations made with the legacy fixed-slot form.
-- Existing rows remain compatible through the original `reminded` column.
begin;

alter table public.hp_reservations add column if not exists reminded boolean not null default false;
alter table public.hp_reservations add column if not exists reminder_status text not null default 'pending';
alter table public.hp_reservations add column if not exists reminder_attempts integer not null default 0;
alter table public.hp_reservations add column if not exists reminder_next_attempt_at timestamptz not null default now();
alter table public.hp_reservations add column if not exists reminder_claimed_until timestamptz;
alter table public.hp_reservations add column if not exists reminder_claim_token uuid;
alter table public.hp_reservations add column if not exists reminder_last_error text;

update public.hp_reservations set reminder_status='sent' where reminded and reminder_status<>'sent';

alter table public.hp_reservations drop constraint if exists hp_reservations_reminder_status_check;
alter table public.hp_reservations add constraint hp_reservations_reminder_status_check
  check (reminder_status in ('pending','sending','sent','failed'));
alter table public.hp_reservations drop constraint if exists hp_reservations_reminder_attempts_check;
alter table public.hp_reservations add constraint hp_reservations_reminder_attempts_check
  check (reminder_attempts between 0 and 5);
alter table public.hp_reservations drop constraint if exists hp_reservations_reminder_claim_check;
alter table public.hp_reservations add constraint hp_reservations_reminder_claim_check
  check ((reminder_status='sending')=(reminder_claimed_until is not null and reminder_claim_token is not null));

create index if not exists hp_reservations_reminder_due
  on public.hp_reservations(reminder_next_attempt_at,slot_datetime)
  where not reminded and reminder_status in ('pending','failed','sending');

create or replace function public.hp_legacy_protect_reminder_state()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if current_user in ('anon','authenticated') and (
    new.reminded is distinct from old.reminded or
    new.reminder_status is distinct from old.reminder_status or
    new.reminder_attempts is distinct from old.reminder_attempts or
    new.reminder_next_attempt_at is distinct from old.reminder_next_attempt_at or
    new.reminder_claimed_until is distinct from old.reminder_claimed_until or
    new.reminder_claim_token is distinct from old.reminder_claim_token or
    new.reminder_last_error is distinct from old.reminder_last_error
  ) then
    raise exception 'reminder_state_managed_by_server';
  end if;
  return new;
end $$;
drop trigger if exists hp_legacy_protect_reminder_state_trg on public.hp_reservations;
create trigger hp_legacy_protect_reminder_state_trg
before update on public.hp_reservations for each row
execute function public.hp_legacy_protect_reminder_state();

create or replace function public.hp_legacy_claim_reminders(p_limit integer default 20)
returns table(
  reservation_id uuid, claim_token uuid, site_id uuid, customer_name text,
  customer_email text, service_name text, starts_at timestamptz, site_name text
) language plpgsql security definer set search_path=public as $$
begin
  if p_limit<1 or p_limit>100 then raise exception 'invalid_limit'; end if;
  update hp_reservations
  set reminder_status='failed',reminder_claimed_until=null,reminder_claim_token=null,
      reminder_next_attempt_at=now(),reminder_last_error='stale_claim'
  where reminder_status='sending' and reminder_claimed_until<=now() and not reminded;

  return query
  with picked as (
    select r.id from hp_reservations r
    where r.status='confirmed' and not r.reminded and r.email<>''
      and r.slot_datetime>now() and r.slot_datetime<now()+interval '36 hours'
      and r.reminder_status in ('pending','failed') and r.reminder_attempts<5
      and r.reminder_next_attempt_at<=now()
    order by r.slot_datetime,r.created_at for update of r skip locked limit p_limit
  ), claimed as (
    update hp_reservations r set reminder_status='sending',reminder_attempts=r.reminder_attempts+1,
      reminder_claimed_until=now()+interval '10 minutes',reminder_claim_token=gen_random_uuid(),reminder_last_error=null
    from picked p where r.id=p.id returning r.*
  )
  select c.id,c.reminder_claim_token,c.site_id,c.name,c.email,coalesce(c.service,''),c.slot_datetime,s.name
  from claimed c join sites s on s.id=c.site_id;
end $$;

create or replace function public.hp_legacy_finish_reminder(
  p_id uuid,p_claim_token uuid,p_success boolean,p_error text default null
) returns boolean language plpgsql security definer set search_path=public as $$
declare changed integer;
begin
  update hp_reservations set
    reminded=case when p_success then true else reminded end,
    reminder_status=case when p_success then 'sent' else 'failed' end,
    reminder_next_attempt_at=case when p_success or reminder_attempts>=5 then reminder_next_attempt_at
      else now()+make_interval(mins=>least(60,5*(2^greatest(reminder_attempts-1,0))::integer)) end,
    reminder_last_error=case when p_success then null else left(coalesce(p_error,'delivery_failed'),500) end,
    reminder_claimed_until=null,reminder_claim_token=null
  where id=p_id and reminder_status='sending' and reminder_claim_token=p_claim_token;
  get diagnostics changed=row_count;
  return changed=1;
end $$;

revoke all on function public.hp_legacy_protect_reminder_state(),public.hp_legacy_claim_reminders(integer),public.hp_legacy_finish_reminder(uuid,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.hp_legacy_claim_reminders(integer),public.hp_legacy_finish_reminder(uuid,uuid,boolean,text) to service_role;
commit;
