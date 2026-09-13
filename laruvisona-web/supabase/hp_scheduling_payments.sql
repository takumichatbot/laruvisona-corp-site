-- Additive opt-in prepayment. Run after hp_scheduling.sql, atomically.
begin;
alter table public.hp_appointments drop constraint if exists hp_appointments_status_check;
alter table public.hp_appointments add constraint hp_appointments_status_check check(status in ('confirmed','canceled','pending_payment','expired'));
alter table public.hp_appointments add column if not exists payment_status text not null default 'onsite' check(payment_status in ('onsite','pending','paid','refund_pending','refunded','review'));
alter table public.hp_appointments add column if not exists hold_until timestamptz;
create table if not exists public.hp_payment_accounts (
 user_id uuid primary key references auth.users(id), account_id text unique,
 livemode boolean, state_hash text, state_expires timestamptz, state_site uuid,
 updated_at timestamptz not null default now()
);
create table if not exists public.hp_booking_payments (
 appointment_id uuid primary key, site_id uuid not null,
 account_id text not null, livemode boolean not null, session_id text unique, intent_id text unique,
 return_url text, attempted_at timestamptz, refund_started_at timestamptz,
 refund_id text, active boolean not null default true, last_checked_at timestamptz, created_at timestamptz not null default now(),
 foreign key(site_id,appointment_id) references public.hp_appointments(site_id,id) on delete cascade
);
alter table public.hp_booking_payments add column if not exists active boolean not null default true;
create index if not exists hp_booking_payments_active_idx
 on public.hp_booking_payments(last_checked_at asc nulls first) where active;
alter table public.hp_payment_accounts enable row level security;
alter table public.hp_booking_payments enable row level security;
revoke all on public.hp_payment_accounts,public.hp_booking_payments from public,anon,authenticated;
grant all on public.hp_payment_accounts,public.hp_booking_payments to service_role;

create or replace function public.hp_schedule_configure(p_site uuid,p_owner uuid,p_config jsonb,p_version bigint)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v bigint; old_active boolean;
begin
 perform 1 from sites where id=p_site and user_id=p_owner for update;
 if not found then raise exception 'not_found'; end if;
 select version into v from hp_booking_calendars where site_id=p_site;
 if coalesce(v,0)<>p_version then raise exception 'config_conflict'; end if;
 if coalesce(p_config->>'paymentMode','onsite') not in ('onsite','prepay') then raise exception 'invalid_payment_mode'; end if;
 if p_config->>'paymentMode'='prepay' and not exists(select 1 from hp_payment_accounts where user_id=p_owner and account_id is not null) then raise exception 'payment_unavailable'; end if;
 -- The API validates the bounded config; legacy appointments must finish before switching engines.
 if (p_config->>'enabled')::boolean and to_regclass('public.hp_reservations') is not null then
  execute 'select exists(select 1 from public.hp_reservations where site_id=$1 and (status=''pending'' or (status=''confirmed'' and slot_datetime>now())))' into old_active using p_site;
  if old_active then raise exception 'legacy_active'; end if;
 end if;
 -- Never silently lose the assigned member/room or menu of a future appointment.
 if exists(select 1 from hp_appointments a where a.site_id=p_site and a.status in ('confirmed','pending_payment') and a.occupied_until>now() and (
   not exists(select 1 from jsonb_array_elements(p_config->'staff') x where x->>'id'=a.staff_id) or
   not exists(select 1 from jsonb_array_elements(p_config->'services') x where x->>'id'=a.service_id) or
   (a.resource_id is not null and not exists(select 1 from jsonb_array_elements(p_config->'resources') x where x->>'id'=a.resource_id)))) then raise exception 'assigned_in_use'; end if;
 insert into hp_booking_calendars(site_id,config,version) values(p_site,p_config,1)
 on conflict(site_id) do update set config=excluded.config,version=hp_booking_calendars.version+1 returning version into v;
 return jsonb_build_object('version',v);
end $$;
create or replace function public.hp_schedule_book(p_site uuid,p_input jsonb,p_token_hash text,p_request_hash text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare a hp_appointments; slot record; svc jsonb; c jsonb; t timestamptz; prepaid boolean; merchant hp_payment_accounts;
begin
 perform 1 from sites where id=p_site and published for update;
 if not found then raise exception 'not_found'; end if;
 select * into a from hp_appointments where site_id=p_site and client_key=(p_input->>'clientKey')::uuid;
 if found then
  if a.token_hash is distinct from p_token_hash or a.request_hash is distinct from p_request_hash then raise exception 'request_conflict'; end if;
  return (to_jsonb(a)-'token_hash'-'request_hash'-'client_key')||jsonb_build_object('replayed',true);
 end if;
 if not exists(select 1 from hp_booking_calendars where site_id=p_site and version=(p_input->>'configVersion')::bigint) then raise exception 'quote_changed'; end if;
 t:=(p_input->>'startsAt')::timestamptz;
 select * into slot from hp_schedule_slots(p_site,(t at time zone 'Asia/Tokyo')::date,p_input->>'serviceId',nullif(p_input->>'staffId','')) s where s.starts_at=t limit 1;
 if not found then raise exception 'slot_taken'; end if;
 select config into c from hp_booking_calendars where site_id=p_site;
 select value into svc from jsonb_array_elements(c->'services') where value->>'id'=p_input->>'serviceId';
 prepaid:=c->>'paymentMode'='prepay' and (svc->>'price')::integer>0;
 if prepaid then
  select m.* into merchant from hp_payment_accounts m join sites s on s.user_id=m.user_id where s.id=p_site;
  if merchant.account_id is null then raise exception 'payment_unavailable'; end if;
  if (svc->>'price')::integer<50 then raise exception 'payment_amount_invalid'; end if;
 end if;
 insert into hp_appointments(site_id,client_key,request_hash,token_hash,service_id,service_name,staff_id,staff_name,resource_id,resource_name,starts_at,ends_at,occupied_until,price,name,email,phone)
 values(p_site,(p_input->>'clientKey')::uuid,p_request_hash,p_token_hash,svc->>'id',svc->>'name',slot.staff_id,slot.staff_name,slot.resource_id,slot.resource_name,slot.starts_at,slot.ends_at,slot.occupied_until,(svc->>'price')::integer,p_input->>'name',p_input->>'email',coalesce(p_input->>'phone','')) returning * into a;
 if prepaid then
  update hp_appointments set status='pending_payment',payment_status='pending',hold_until=now()+interval '60 minutes' where id=a.id returning * into a;
  insert into hp_booking_payments(appointment_id,site_id,account_id,livemode) values(a.id,p_site,merchant.account_id,merchant.livemode);
 end if;
 insert into hp_booking_allocations values(p_site,a.id,'staff',a.staff_id,tstzrange(a.starts_at,a.occupied_until,'[)'));
 if a.resource_id is not null then insert into hp_booking_allocations values(p_site,a.id,'resource',a.resource_id,tstzrange(a.starts_at,a.occupied_until,'[)')); end if;
 if not coalesce(prepaid,false) then
 insert into hp_booking_events(site_id,appointment_id,revision,action,snapshot) values(p_site,a.id,a.revision,'created',to_jsonb(a)-'token_hash'-'request_hash'-'client_key');
 end if;
 return (to_jsonb(a)-'token_hash'-'request_hash'-'client_key')||jsonb_build_object('replayed',false);
end $$;
create or replace function public.hp_schedule_change(p_site uuid,p_id uuid,p_token_hash text,p_owner uuid,p_action text,p_start timestamptz,p_staff text,p_revision integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare a hp_appointments; slot record; c jsonb;
begin
 perform 1 from sites where id=p_site for update;
 select * into a from hp_appointments where site_id=p_site and id=p_id for update;
 if not found or not (coalesce(a.token_hash=p_token_hash,false) or exists(select 1 from sites where id=p_site and user_id=p_owner)) then raise exception 'not_found'; end if;
 if p_action='lookup' then return to_jsonb(a)-'token_hash'-'request_hash'-'client_key'; end if;
 if p_action not in ('cancel','reschedule') then raise exception 'invalid_action'; end if;
 if a.revision<>p_revision then raise exception 'booking_conflict'; end if;
 if a.status in ('canceled','expired') then raise exception 'already_canceled'; end if;
 if a.status='pending_payment' then raise exception 'payment_pending'; end if;
 if a.payment_status in ('refund_pending','review') then raise exception 'refund_in_progress'; end if;
 select config into c from hp_booking_calendars where site_id=p_site;
 if not exists(select 1 from sites where id=p_site and user_id=p_owner) and a.starts_at<=now()+make_interval(hours=>coalesce((c->>'cancelHours')::integer,24)) then raise exception 'change_closed'; end if;
 if p_action='reschedule' then
  select * into slot from hp_schedule_slots(p_site,(p_start at time zone 'Asia/Tokyo')::date,a.service_id,nullif(p_staff,''),a.id) s where s.starts_at=p_start limit 1;
  if not found then raise exception 'slot_taken'; end if;
 end if;
 if p_action='cancel' then
  if a.payment_status='paid' then
   -- Keep the scarce units blocked until Stripe proves the full refund. A failed refund must not create an overbooking.
   update hp_appointments set payment_status='refund_pending',revision=revision+1,updated_at=now() where id=a.id returning * into a;
   update hp_booking_payments set active=true,last_checked_at=null where appointment_id=a.id;
  else
   delete from hp_booking_allocations where appointment_id=a.id;
   update hp_appointments set status='canceled',revision=revision+1,updated_at=now() where id=a.id returning * into a;
  end if;
 else
  -- The delete + replacement is one transaction: failure restores the previous allocations.
  delete from hp_booking_allocations where appointment_id=a.id;
  update hp_appointments set staff_id=slot.staff_id,staff_name=slot.staff_name,resource_id=slot.resource_id,resource_name=slot.resource_name,starts_at=slot.starts_at,ends_at=slot.ends_at,occupied_until=slot.occupied_until,revision=revision+1,updated_at=now() where id=a.id returning * into a;
  insert into hp_booking_allocations values(p_site,a.id,'staff',a.staff_id,tstzrange(a.starts_at,a.occupied_until,'[)'));
  if a.resource_id is not null then insert into hp_booking_allocations values(p_site,a.id,'resource',a.resource_id,tstzrange(a.starts_at,a.occupied_until,'[)')); end if;
 end if;
 if a.payment_status<>'refund_pending' then
  insert into hp_booking_events(site_id,appointment_id,revision,action,snapshot) values(p_site,a.id,a.revision,p_action,to_jsonb(a)-'token_hash'-'request_hash'-'client_key');
 end if;
 return to_jsonb(a)-'token_hash'-'request_hash'-'client_key';
end $$;

-- Private RPCs, called only after server-side ownership/token checks.
create or replace function public.hp_payment_prepare(p_site uuid,p_id uuid,p_token_hash text,p_return text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare a hp_appointments; p hp_booking_payments;
begin
 perform 1 from sites where id=p_site for update;
 select * into a from hp_appointments where id=p_id and site_id=p_site for update;
 if not found or a.token_hash is distinct from p_token_hash then raise exception 'not_found'; end if;
 select * into p from hp_booking_payments where appointment_id=p_id for update;
 if not found or a.status<>'pending_payment' then raise exception 'payment_pending'; end if;
 -- A stable body/idempotency key is persisted before making the Stripe request.
 if p.attempted_at is null then
  if a.hold_until<now()+interval '31 minutes' then raise exception 'payment_expired'; end if;
  update hp_booking_payments set attempted_at=now(),return_url=p_return where appointment_id=p_id returning * into p;
 end if;
 return to_jsonb(p)||jsonb_build_object('appointment',to_jsonb(a)-'token_hash'-'request_hash'-'client_key');
end $$;
create or replace function public.hp_payment_attach(p_site uuid,p_id uuid,p_session text)
returns void language plpgsql security definer set search_path=public as $$
begin
 perform 1 from sites where id=p_site for update;
 update hp_booking_payments set session_id=p_session where site_id=p_site and appointment_id=p_id and (session_id is null or session_id=p_session);
 if not found then raise exception 'payment_mismatch'; end if;
end $$;
-- Stripe observations, never a browser assertion or a return-page query string.
create or replace function public.hp_payment_settle(p_site uuid,p_id uuid,p_state text,p_session text,p_intent text,p_amount integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare a hp_appointments; p hp_booking_payments; action_name text;
begin
 perform 1 from sites where id=p_site for update;
 select * into a from hp_appointments where id=p_id and site_id=p_site for update;
 select * into p from hp_booking_payments where appointment_id=p_id and site_id=p_site for update;
 if a.id is null or p.appointment_id is null then raise exception 'not_found'; end if;
 if p_state='abandoned' then
  if p.attempted_at is not null or a.hold_until>now() then raise exception 'payment_mismatch'; end if;
 elsif p_state='review' then
  null;
 elsif p.session_id is null or p.session_id is distinct from p_session then raise exception 'payment_mismatch';
 end if;
 if p_state='paid' then
  if p_amount is distinct from a.price or p_intent is null then raise exception 'payment_mismatch'; end if;
  if p.intent_id is not null and p.intent_id<>p_intent then raise exception 'payment_mismatch'; end if;
  update hp_booking_payments set intent_id=p_intent where appointment_id=p_id;
  if a.status='pending_payment' then
   update hp_appointments set status='confirmed',payment_status='paid',revision=revision+1,updated_at=now() where id=p_id returning * into a;
   update hp_booking_payments set active=false where appointment_id=p_id;
   action_name:='created';
  elsif a.status in ('expired','canceled') and a.payment_status='pending' then
   update hp_appointments set payment_status='refund_pending',revision=revision+1,updated_at=now() where id=p_id returning * into a;
   update hp_booking_payments set active=true where appointment_id=p_id;
  end if;
 elsif p_state in ('expired','abandoned') then
  if a.status='pending_payment' then
   delete from hp_booking_allocations where appointment_id=p_id;
   update hp_appointments set status='expired',revision=revision+1,updated_at=now() where id=p_id returning * into a;
   update hp_booking_payments set active=false where appointment_id=p_id;
  end if;
 elsif p_state='refunded' then
  if p_amount is distinct from a.price or p.intent_id is distinct from p_intent then raise exception 'payment_mismatch'; end if;
  if a.payment_status<>'refunded' then
   delete from hp_booking_allocations where appointment_id=p_id;
   update hp_appointments set status='canceled',payment_status='refunded',revision=revision+1,updated_at=now() where id=p_id returning * into a;
   update hp_booking_payments set active=false where appointment_id=p_id;
   action_name:='refund';
  end if;
 elsif p_state='review' then
  update hp_appointments set payment_status='review',updated_at=now() where id=p_id returning * into a;
  update hp_booking_payments set active=false where appointment_id=p_id;
 else raise exception 'invalid_action';
 end if;
 update hp_booking_payments set last_checked_at=now() where appointment_id=p_id;
 if action_name is not null then
  insert into hp_booking_events(site_id,appointment_id,revision,action,snapshot) values(p_site,p_id,a.revision,action_name,to_jsonb(a)-'token_hash'-'request_hash'-'client_key');
 end if;
 return to_jsonb(a)-'token_hash'-'request_hash'-'client_key';
end $$;
revoke all on function public.hp_payment_prepare(uuid,uuid,text,text),public.hp_payment_attach(uuid,uuid,text),public.hp_payment_settle(uuid,uuid,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.hp_payment_prepare(uuid,uuid,text,text),public.hp_payment_attach(uuid,uuid,text),public.hp_payment_settle(uuid,uuid,text,text,text,integer) to service_role;
commit;
