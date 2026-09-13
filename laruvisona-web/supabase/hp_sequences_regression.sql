\echo '--- ステップ配信 ---'
do $$
declare owner_id uuid := '10000000-0000-4000-8000-000000000010';
declare site_id uuid := '20000000-0000-4000-8000-000000000010';
declare contact1 uuid; declare contact2 uuid; declare claim record; declare result jsonb; declare n integer;
begin
  insert into auth.users(id) values(owner_id);
  insert into public.sites(id,user_id,name,slug,published) values(site_id,owner_id,'配信店','sequence-shop',true);
  insert into public.hp_sequences(id,site_id,user_id,name,trigger,steps,active) values(
    'sequence-a',site_id,owner_id,'問い合わせ後','contact_form',
    '[{"delay":0,"subject":"最初","body":"{{name}}様"},{"delay":24,"subject":"次","body":"本文"}]'::jsonb,true
  );
  insert into public.contacts(site_id,name,email) values(site_id,'一人目','one@example.test') returning id into contact1;
  result:=public.laruhp_sequence_enroll(contact1,site_id,'contact_form');
  if result->>'enrolled'<>'true' then raise exception 'not enrolled: %',result; end if;
  result:=public.laruhp_sequence_enroll(contact1,site_id,'contact_form');
  if result->>'enrolled'<>'false' then raise exception 'duplicate enrolled: %',result; end if;
  select * into claim from public.laruhp_sequence_claim(10);
  if claim.contact_name<>'一人目' or claim.step_index<>0 then raise exception 'claim mismatch'; end if;
  result:=public.laruhp_sequence_finish(claim.enrollment_id,claim.claim_token,true,'email-1',null);
  if result->>'state'<>'queued' then raise exception 'first finish failed: %',result; end if;
  result:=public.laruhp_sequence_finish(claim.enrollment_id,claim.claim_token,true,'email-1',null);
  if result->>'reason'<>'stale_claim' then raise exception 'stale claim accepted'; end if;
  update public.hp_sequence_enrollments set next_send_at=now() where id=claim.enrollment_id;
  select * into claim from public.laruhp_sequence_claim(10);
  result:=public.laruhp_sequence_finish(claim.enrollment_id,claim.claim_token,true,'email-2',null);
  if result->>'state'<>'completed' then raise exception 'completion failed: %',result; end if;
  select count(*) into n from public.hp_sequence_deliveries where enrollment_id=claim.enrollment_id;
  if n<>2 then raise exception 'delivery count %',n; end if;

  insert into public.contacts(site_id,name,email) values(site_id,'二人目','two@example.test') returning id into contact2;
  perform public.laruhp_sequence_enroll(contact2,site_id,'contact_form');
  select * into claim from public.laruhp_sequence_claim(10);
  perform public.laruhp_sequence_finish(claim.enrollment_id,claim.claim_token,false,null,'temporary');
  if not exists(select 1 from public.hp_sequence_enrollments where id=claim.enrollment_id and state='queued' and attempt_count=1 and last_error='temporary') then
    raise exception 'retry state missing';
  end if;
  if has_table_privilege('anon','public.hp_sequences','SELECT') or has_table_privilege('authenticated','public.hp_sequence_enrollments','SELECT') then
    raise exception 'sequence tables exposed';
  end if;
  if has_function_privilege('authenticated','public.laruhp_sequence_claim(integer)','EXECUTE') then raise exception 'claim RPC exposed'; end if;
end $$;

set role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000010"}',false);
do $$ declare n integer; begin
  select count(*) into n from public.hp_sequences;
  if n<>1 then raise exception 'owner cannot see sequence'; end if;
end $$;
reset role;
\echo 'ステップ配信: 12項目 OK'
