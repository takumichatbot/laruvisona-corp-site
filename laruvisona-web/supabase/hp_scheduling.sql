-- Opt-in scheduling. Apply atomically; no existing booking data is rewritten.
begin;
create extension if not exists btree_gist;
create table if not exists public.hp_booking_calendars (
 site_id uuid primary key references public.sites(id) on delete cascade,
 config jsonb not null, version bigint not null default 1 check(version>0)
);
create table if not exists public.hp_appointments (
 id uuid primary key default gen_random_uuid(), site_id uuid not null references public.sites(id) on delete cascade,
 client_key uuid not null, request_hash text not null, token_hash text not null,
 service_id text not null, service_name text not null, staff_id text not null, staff_name text not null,
 resource_id text, resource_name text, starts_at timestamptz not null, ends_at timestamptz not null,
 occupied_until timestamptz not null, price integer not null check(price>=0),
 name text not null, email text not null, phone text not null default '',
 status text not null default 'confirmed' check(status in ('confirmed','canceled')),
 revision integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(site_id,client_key), unique(site_id,id),
 check(starts_at<ends_at and ends_at<=occupied_until),
 check(token_hash ~ '^[a-f0-9]{64}$' and request_hash ~ '^[a-f0-9]{64}$')
);
create index if not exists hp_appointments_agenda on public.hp_appointments(site_id,starts_at);
create table if not exists public.hp_booking_allocations (
 site_id uuid not null, appointment_id uuid not null, kind text not null check(kind in ('staff','resource')),
 unit_id text not null, span tstzrange not null,
 foreign key(site_id,appointment_id) references public.hp_appointments(site_id,id) on delete cascade,
 primary key(appointment_id,kind),
 check(not isempty(span) and not lower_inf(span) and not upper_inf(span) and lower_inc(span) and not upper_inc(span)),
 exclude using gist (site_id with =,kind with =,unit_id with =,span with &&)
);
-- Durable events make notification failure visible; reservation success never depends on mail delivery.
create table if not exists public.hp_booking_events (
 id uuid primary key default gen_random_uuid(), site_id uuid not null, appointment_id uuid not null,
 revision integer not null, action text not null, snapshot jsonb not null default '{}', owner_notified boolean not null default false, customer_notified boolean not null default false, created_at timestamptz not null default now(), notified boolean not null default false,
 foreign key(site_id,appointment_id) references public.hp_appointments(site_id,id) on delete cascade,
 unique(appointment_id,revision)
);
alter table public.hp_booking_calendars enable row level security;
alter table public.hp_appointments enable row level security;
alter table public.hp_booking_allocations enable row level security;
alter table public.hp_booking_events enable row level security;
revoke all on public.hp_booking_calendars,public.hp_appointments,public.hp_booking_allocations,public.hp_booking_events from public,anon,authenticated;
grant select on public.hp_booking_calendars,public.hp_appointments,public.hp_booking_events to authenticated;
grant all on public.hp_booking_calendars,public.hp_appointments,public.hp_booking_allocations,public.hp_booking_events to service_role;
drop policy if exists schedule_owner on public.hp_booking_calendars;
create policy schedule_owner on public.hp_booking_calendars for select to authenticated using(exists(select 1 from public.sites s where s.id=site_id and s.user_id=auth.uid()));
drop policy if exists appointments_owner on public.hp_appointments;
create policy appointments_owner on public.hp_appointments for select to authenticated using(exists(select 1 from public.sites s where s.id=site_id and s.user_id=auth.uid()));
drop policy if exists booking_events_owner on public.hp_booking_events;
create policy booking_events_owner on public.hp_booking_events for select to authenticated using(exists(select 1 from public.sites s where s.id=site_id and s.user_id=auth.uid()));

-- Single authoritative availability calculation. The reserve transaction calls this again under the site lock.
create or replace function public.hp_schedule_slots(p_site uuid,p_day date,p_service text,p_staff text default null,p_ignore uuid default null)
returns table(starts_at timestamptz,ends_at timestamptz,occupied_until timestamptz,staff_id text,staff_name text,resource_id text,resource_name text)
language plpgsql security definer set search_path=public as $$
declare c jsonb; svc jsonb; person jsonb; room jsonb; w jsonb; sw jsonb; n integer; dow integer;
 t timestamptz; finish timestamptz; occupied timestamptz; room_id text; room_name text; room_ok boolean;
begin
 select config into c from hp_booking_calendars where site_id=p_site;
 if c is null or not (c->>'enabled')::boolean or not exists(select 1 from sites where id=p_site and published) then return; end if;
 if p_day<(now() at time zone 'Asia/Tokyo')::date or p_day>(now() at time zone 'Asia/Tokyo')::date+(c->>'advanceDays')::integer or (c->'daysOff') ? p_day::text then return; end if;
 select value into svc from jsonb_array_elements(c->'services') where value->>'id'=p_service;
 if svc is null then return; end if;
 dow:=extract(dow from p_day)::integer;
 for w in select value from jsonb_array_elements(c->'weekly'->dow) loop
  for n in select generate_series((w->>'start')::integer,(w->>'end')::integer-(svc->>'duration')::integer-(svc->>'buffer')::integer,(c->>'step')::integer) loop
   t:=(p_day::timestamp+make_interval(mins=>n)) at time zone 'Asia/Tokyo';
   finish:=t+make_interval(mins=>(svc->>'duration')::integer); occupied:=finish+make_interval(mins=>(svc->>'buffer')::integer);
   if t<now()+make_interval(mins=>(c->>'leadMinutes')::integer) then continue; end if;
   for person in select value from jsonb_array_elements(c->'staff') where (svc->'staffIds') ? (value->>'id') and (p_staff is null or value->>'id'=p_staff) loop
    if (person->'daysOff') ? p_day::text then continue; end if;
    if not exists(select 1 from jsonb_array_elements(person->'weekly'->dow) x where (x->>'start')::integer<=n and (x->>'end')::integer>=n+(svc->>'duration')::integer+(svc->>'buffer')::integer) then continue; end if;
    if exists(select 1 from hp_booking_allocations a where a.site_id=p_site and a.kind='staff' and a.unit_id=person->>'id' and (p_ignore is null or a.appointment_id<>p_ignore) and a.span && tstzrange(t,occupied,'[)')) then continue; end if;
    room_id:=null; room_name:=null; room_ok:=jsonb_array_length(svc->'resourceIds')=0;
    for room in select value from jsonb_array_elements(c->'resources') where (svc->'resourceIds') ? (value->>'id') loop
     if not exists(select 1 from hp_booking_allocations a where a.site_id=p_site and a.kind='resource' and a.unit_id=room->>'id' and (p_ignore is null or a.appointment_id<>p_ignore) and a.span && tstzrange(t,occupied,'[)')) then
      room_id:=room->>'id'; room_name:=room->>'name'; room_ok:=true; exit;
     end if;
    end loop;
    if room_ok then
     starts_at:=t; ends_at:=finish; occupied_until:=occupied; staff_id:=person->>'id'; staff_name:=person->>'name'; resource_id:=room_id; resource_name:=room_name; return next; exit; -- One valid allocation per start is sufficient; reserve recalculates under lock.
    end if;
   end loop;
  end loop;
 end loop;
end $$;

create or replace function public.hp_schedule_configure(p_site uuid,p_owner uuid,p_config jsonb,p_version bigint)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v bigint; old_active boolean;
begin
 perform 1 from sites where id=p_site and user_id=p_owner for update;
 if not found then raise exception 'not_found'; end if;
 select version into v from hp_booking_calendars where site_id=p_site;
 if coalesce(v,0)<>p_version then raise exception 'config_conflict'; end if;
 -- The API validates the bounded config; legacy appointments must finish before switching engines.
 if (p_config->>'enabled')::boolean and to_regclass('public.hp_reservations') is not null then
  execute 'select exists(select 1 from public.hp_reservations where site_id=$1 and (status=''pending'' or (status=''confirmed'' and slot_datetime>now())))' into old_active using p_site;
  if old_active then raise exception 'legacy_active'; end if;
 end if;
 -- Never silently lose the assigned member/room or menu of a future appointment.
 if exists(select 1 from hp_appointments a where a.site_id=p_site and a.status='confirmed' and a.occupied_until>now() and (
   not exists(select 1 from jsonb_array_elements(p_config->'staff') x where x->>'id'=a.staff_id) or
   not exists(select 1 from jsonb_array_elements(p_config->'services') x where x->>'id'=a.service_id) or
   (a.resource_id is not null and not exists(select 1 from jsonb_array_elements(p_config->'resources') x where x->>'id'=a.resource_id)))) then raise exception 'assigned_in_use'; end if;
 insert into hp_booking_calendars(site_id,config,version) values(p_site,p_config,1)
 on conflict(site_id) do update set config=excluded.config,version=hp_booking_calendars.version+1 returning version into v;
 return jsonb_build_object('version',v);
end $$;

create or replace function public.hp_schedule_book(p_site uuid,p_input jsonb,p_token_hash text,p_request_hash text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare a hp_appointments; slot record; svc jsonb; c jsonb; t timestamptz;
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
 insert into hp_appointments(site_id,client_key,request_hash,token_hash,service_id,service_name,staff_id,staff_name,resource_id,resource_name,starts_at,ends_at,occupied_until,price,name,email,phone)
 values(p_site,(p_input->>'clientKey')::uuid,p_request_hash,p_token_hash,svc->>'id',svc->>'name',slot.staff_id,slot.staff_name,slot.resource_id,slot.resource_name,slot.starts_at,slot.ends_at,slot.occupied_until,(svc->>'price')::integer,p_input->>'name',p_input->>'email',coalesce(p_input->>'phone','')) returning * into a;
 insert into hp_booking_allocations values(p_site,a.id,'staff',a.staff_id,tstzrange(a.starts_at,a.occupied_until,'[)'));
 if a.resource_id is not null then insert into hp_booking_allocations values(p_site,a.id,'resource',a.resource_id,tstzrange(a.starts_at,a.occupied_until,'[)')); end if;
 insert into hp_booking_events(site_id,appointment_id,revision,action,snapshot) values(p_site,a.id,a.revision,'created',to_jsonb(a)-'token_hash'-'request_hash'-'client_key');
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
 if a.status='canceled' then raise exception 'already_canceled'; end if;
 select config into c from hp_booking_calendars where site_id=p_site;
 if not exists(select 1 from sites where id=p_site and user_id=p_owner) and a.starts_at<=now()+make_interval(hours=>coalesce((c->>'cancelHours')::integer,24)) then raise exception 'change_closed'; end if;
 if p_action='reschedule' then
  select * into slot from hp_schedule_slots(p_site,(p_start at time zone 'Asia/Tokyo')::date,a.service_id,nullif(p_staff,''),a.id) s where s.starts_at=p_start limit 1;
  if not found then raise exception 'slot_taken'; end if;
 end if;
 -- The delete + replacement is one transaction: failure restores the previous allocations.
 delete from hp_booking_allocations where appointment_id=a.id;
 if p_action='cancel' then
  update hp_appointments set status='canceled',revision=revision+1,updated_at=now() where id=a.id returning * into a;
 else
  update hp_appointments set staff_id=slot.staff_id,staff_name=slot.staff_name,resource_id=slot.resource_id,resource_name=slot.resource_name,starts_at=slot.starts_at,ends_at=slot.ends_at,occupied_until=slot.occupied_until,revision=revision+1,updated_at=now() where id=a.id returning * into a;
  insert into hp_booking_allocations values(p_site,a.id,'staff',a.staff_id,tstzrange(a.starts_at,a.occupied_until,'[)'));
  if a.resource_id is not null then insert into hp_booking_allocations values(p_site,a.id,'resource',a.resource_id,tstzrange(a.starts_at,a.occupied_until,'[)')); end if;
 end if;
 insert into hp_booking_events(site_id,appointment_id,revision,action,snapshot) values(p_site,a.id,a.revision,p_action,to_jsonb(a)-'token_hash'-'request_hash'-'client_key');
 return to_jsonb(a)-'token_hash'-'request_hash'-'client_key';
end $$;

-- Serialize legacy INSERT with opt-in. Old paid reservations must be settled before opt-in.
create or replace function public.hp_schedule_legacy_guard() returns trigger language plpgsql security definer set search_path=public as $$
begin
 perform 1 from sites where id=new.site_id for update;
 if new.status<>'canceled' and (exists(select 1 from hp_booking_calendars where site_id=new.site_id and (config->>'enabled')::boolean) or exists(select 1 from hp_appointments where site_id=new.site_id and status='confirmed' and occupied_until>now())) then raise exception 'schedule_enabled'; end if;
 return new;
end $$;
do $$ begin
 if to_regclass('public.hp_reservations') is not null then
  execute 'drop trigger if exists hp_schedule_legacy_guard on public.hp_reservations';
  execute 'create trigger hp_schedule_legacy_guard before insert or update on public.hp_reservations for each row execute function public.hp_schedule_legacy_guard()';
 end if;
end $$;
revoke all on function public.hp_schedule_slots(uuid,date,text,text,uuid),public.hp_schedule_configure(uuid,uuid,jsonb,bigint),public.hp_schedule_book(uuid,jsonb,text,text),public.hp_schedule_change(uuid,uuid,text,uuid,text,timestamptz,text,integer),public.hp_schedule_legacy_guard() from public,anon,authenticated;
grant execute on function public.hp_schedule_slots(uuid,date,text,text,uuid),public.hp_schedule_configure(uuid,uuid,jsonb,bigint),public.hp_schedule_book(uuid,jsonb,text,text),public.hp_schedule_change(uuid,uuid,text,uuid,text,timestamptz,text,integer) to service_role;
commit;
