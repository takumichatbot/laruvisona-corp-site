\echo '--- 本格予約 ---'
do $$
declare
  owner_id uuid := '10000000-0000-4000-8000-000000000120';
  v_site_id uuid := '20000000-0000-4000-8000-000000000120';
  first_key uuid := '30000000-0000-4000-8000-000000000120';
  second_key uuid := '30000000-0000-4000-8000-000000000121';
  v_day date := (now() at time zone 'Asia/Tokyo')::date+2;
  dow integer;
  weekly jsonb := '[[],[],[],[],[],[],[]]'::jsonb;
  config jsonb;
  result jsonb;
  v_appointment_id uuid;
  start_at timestamptz;
  taken boolean := false;
  n integer := 0;
begin
  dow:=extract(dow from v_day)::integer;
  weekly:=jsonb_set(weekly,array[dow::text],jsonb_build_array(jsonb_build_object('start',600,'end',720)));
  config:=jsonb_build_object(
    'enabled',true,'advanceDays',30,'daysOff','[]'::jsonb,'leadMinutes',0,'step',30,'cancelHours',0,
    'weekly',weekly,
    'services',jsonb_build_array(jsonb_build_object('id','svc','name','相談','duration',60,'buffer',0,'price',5000,'staffIds',jsonb_build_array('staff'),'resourceIds',jsonb_build_array('room'))),
    'staff',jsonb_build_array(jsonb_build_object('id','staff','name','担当','daysOff','[]'::jsonb,'weekly',weekly)),
    'resources',jsonb_build_array(jsonb_build_object('id','room','name','個室'))
  );
  insert into auth.users(id) values(owner_id);
  insert into public.sites(id,user_id,name,slug,published) values(v_site_id,owner_id,'予約回帰','schedule-regression',true);

  result:=public.hp_schedule_configure(v_site_id,owner_id,config,0);
  if (result->>'version')::integer<>1 then raise exception 'initial version mismatch: %',result; end if; n:=n+1;
  if (select count(*) from public.hp_schedule_slots(v_site_id,v_day,'svc',null,null))<>3 then raise exception 'slot count mismatch'; end if; n:=n+1;
  select s.starts_at into start_at from public.hp_schedule_slots(v_site_id,v_day,'svc',null,null) s order by s.starts_at limit 1;

  result:=public.hp_schedule_book(v_site_id,jsonb_build_object('clientKey',first_key,'configVersion',1,'startsAt',start_at,'serviceId','svc','staffId','','name','予約者','email','person@example.test','phone',''),repeat('a',64),repeat('b',64));
  v_appointment_id:=(result->>'id')::uuid;
  if coalesce((result->>'replayed')::boolean,true) then raise exception 'first booking marked replay'; end if; n:=n+1;
  if (select count(*) from public.hp_booking_allocations a where a.appointment_id=v_appointment_id)<>2 then raise exception 'staff/resource allocation missing'; end if; n:=n+1;
  if (select count(*) from public.hp_booking_events e where e.appointment_id=v_appointment_id and e.action='created')<>1 then raise exception 'created event missing'; end if; n:=n+1;

  result:=public.hp_schedule_book(v_site_id,jsonb_build_object('clientKey',first_key,'configVersion',1,'startsAt',start_at,'serviceId','svc','staffId','','name','予約者','email','person@example.test','phone',''),repeat('a',64),repeat('b',64));
  if not coalesce((result->>'replayed')::boolean,false) then raise exception 'idempotent replay missing'; end if; n:=n+1;
  if (select count(*) from public.hp_appointments a where a.site_id=v_site_id)<>1 then raise exception 'replay duplicated appointment'; end if; n:=n+1;

  begin
    perform public.hp_schedule_book(v_site_id,jsonb_build_object('clientKey',second_key,'configVersion',1,'startsAt',start_at,'serviceId','svc','staffId','','name','別予約','email','other@example.test','phone',''),repeat('c',64),repeat('d',64));
  exception when others then taken:=sqlerrm='slot_taken'; end;
  if not taken then raise exception 'overlapping booking was accepted'; end if; n:=n+1;

  result:=public.hp_schedule_change(v_site_id,v_appointment_id,repeat('a',64),null,'cancel',null,null,1);
  if result->>'status'<>'canceled' or (result->>'revision')::integer<>2 then raise exception 'cancel failed: %',result; end if; n:=n+1;
  if exists(select 1 from public.hp_booking_allocations a where a.appointment_id=v_appointment_id) then raise exception 'allocation survived cancellation'; end if; n:=n+1;
  if (select count(*) from public.hp_booking_events e where e.appointment_id=v_appointment_id and e.action='cancel')<>1 then raise exception 'cancel event missing'; end if; n:=n+1;
  if not exists(select 1 from public.hp_schedule_slots(v_site_id,v_day,'svc',null,null) s where s.starts_at=start_at) then raise exception 'canceled slot was not released'; end if; n:=n+1;

  if n<>12 then raise exception 'assertion count mismatch: %',n; end if;
  raise notice '本格予約: %項目 OK',n;
end $$;
