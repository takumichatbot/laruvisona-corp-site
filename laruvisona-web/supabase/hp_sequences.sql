-- LARU HP ステップ配信。設定・進行・送信結果を分離し、同時実行でも一通だけ送る。
create table if not exists public.hp_sequences (
  id text not null,
  site_id uuid not null references public.sites(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check(char_length(name) between 1 and 100),
  trigger text not null check(trigger in ('contact_form','booking','manual')),
  steps jsonb not null check(jsonb_typeof(steps)='array' and jsonb_array_length(steps) between 1 and 20),
  active boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(site_id,id)
);
alter table public.hp_sequences add column if not exists deleted_at timestamptz;
create index if not exists hp_sequences_site_created_idx on public.hp_sequences(site_id,created_at);

create table if not exists public.hp_sequence_enrollments (
  id uuid primary key default gen_random_uuid(),
  sequence_id text not null,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  step_index integer not null default 0 check(step_index>=0),
  next_send_at timestamptz not null default now(),
  state text not null default 'queued' check(state in ('queued','processing','completed','cancelled','failed')),
  attempt_count integer not null default 0 check(attempt_count>=0),
  claim_token uuid,
  claimed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(site_id,sequence_id) references public.hp_sequences(site_id,id) on delete cascade,
  unique(site_id,sequence_id,contact_id)
);
create index if not exists hp_sequence_enrollments_due_idx on public.hp_sequence_enrollments(next_send_at,id)
  where state in ('queued','processing');

create table if not exists public.hp_sequence_deliveries (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.hp_sequence_enrollments(id) on delete cascade,
  step_index integer not null,
  provider_email_id text not null,
  sent_at timestamptz not null default now(),
  unique(enrollment_id,step_index)
);

alter table public.hp_sequences enable row level security;
alter table public.hp_sequence_enrollments enable row level security;
alter table public.hp_sequence_deliveries enable row level security;
drop policy if exists "Owners see own sequences" on public.hp_sequences;
create policy "Owners see own sequences" on public.hp_sequences for select to authenticated using(user_id=auth.uid());
revoke all on public.hp_sequences,public.hp_sequence_enrollments,public.hp_sequence_deliveries from anon,authenticated;
grant select on public.hp_sequences to authenticated;
grant all on public.hp_sequences,public.hp_sequence_enrollments,public.hp_sequence_deliveries to service_role;

-- 旧settings_jsonから設定を一度だけ移す。旧IDを保つため主キーはtext。
insert into public.hp_sequences(id,site_id,user_id,name,trigger,steps,active,created_at,updated_at)
select seq->>'id',s.id,s.user_id,left(seq->>'name',100),
       case when seq->>'trigger' in ('contact_form','booking','manual') then seq->>'trigger' else 'contact_form' end,
       seq->'steps',(seq->>'active')='true',
       case when pg_input_is_valid(seq->>'createdAt','timestamp with time zone') then (seq->>'createdAt')::timestamptz else now() end,now()
from public.sites s cross join lateral jsonb_array_elements(
  case when jsonb_typeof(s.settings_json->'sequences')='array' then s.settings_json->'sequences' else '[]'::jsonb end
) seq
where seq ? 'id' and seq ? 'name' and char_length(seq->>'id') between 1 and 80 and char_length(seq->>'name') between 1 and 100
  and jsonb_typeof(seq->'steps')='array' and jsonb_array_length(seq->'steps') between 1 and 20
on conflict(site_id,id) do nothing;

-- 旧方式で進行中の顧客も新しいキューへ移す。
insert into public.hp_sequence_enrollments(sequence_id,contact_id,site_id,step_index,next_send_at)
select c.extra_fields->>'_seq_id',c.id,c.site_id,
       case when c.extra_fields->>'_seq_step' ~ '^[0-9]{1,3}$' then (c.extra_fields->>'_seq_step')::integer else 0 end,
       case when pg_input_is_valid(c.extra_fields->>'_seq_next','timestamp with time zone') then (c.extra_fields->>'_seq_next')::timestamptz else now() end
from public.contacts c join public.hp_sequences s on s.id=c.extra_fields->>'_seq_id' and s.site_id=c.site_id
where c.extra_fields ? '_seq_id'
on conflict(site_id,sequence_id,contact_id) do nothing;

create or replace function public.laruhp_sequence_enroll(p_contact uuid,p_site uuid,p_trigger text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_sequence public.hp_sequences%rowtype; v_id uuid;
begin
  if p_trigger not in ('contact_form','booking','manual') then raise exception 'invalid_trigger'; end if;
  if not exists(select 1 from public.contacts where id=p_contact and site_id=p_site) then raise exception 'contact_not_found'; end if;
  select * into v_sequence from public.hp_sequences where site_id=p_site and trigger=p_trigger and active and deleted_at is null order by created_at,id limit 1;
  if not found then return jsonb_build_object('ok',true,'enrolled',false); end if;
  insert into public.hp_sequence_enrollments(sequence_id,contact_id,site_id,next_send_at)
  values(v_sequence.id,p_contact,p_site,now()) on conflict(sequence_id,contact_id) do nothing returning id into v_id;
  return jsonb_build_object('ok',true,'enrolled',v_id is not null,'enrollment_id',v_id,'sequence_id',v_sequence.id);
end $$;

create or replace function public.laruhp_sequence_claim(p_limit integer default 100)
returns table(enrollment_id uuid,claim_token uuid,step_index integer,email text,contact_name text,site_name text,sequence_steps jsonb)
language sql security definer set search_path=public as $$
  with candidates as (
    select e.id from public.hp_sequence_enrollments e join public.hp_sequences s on s.site_id=e.site_id and s.id=e.sequence_id
    where s.active and s.deleted_at is null and e.next_send_at<=now() and (e.state='queued' or (e.state='processing' and e.claimed_at<now()-interval '15 minutes'))
    order by e.next_send_at,e.id for update of e skip locked limit greatest(1,least(coalesce(p_limit,100),200))
  ), claimed as (
    update public.hp_sequence_enrollments e set state='processing',claim_token=gen_random_uuid(),claimed_at=now(),updated_at=now()
    from candidates c where e.id=c.id returning e.*
  )
  select c.id,c.claim_token,c.step_index,ct.email,ct.name,s.name,q.steps
  from claimed c join public.contacts ct on ct.id=c.contact_id and ct.site_id=c.site_id
  join public.hp_sequences q on q.site_id=c.site_id and q.id=c.sequence_id
  join public.sites s on s.id=c.site_id;
$$;

create or replace function public.laruhp_sequence_enroll_specific(p_contact uuid,p_site uuid,p_sequence text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  if not exists(select 1 from public.contacts where id=p_contact and site_id=p_site and nullif(email,'') is not null) then raise exception 'contact_not_found'; end if;
  if not exists(select 1 from public.hp_sequences where site_id=p_site and id=p_sequence and trigger='manual' and active and deleted_at is null) then raise exception 'sequence_not_found'; end if;
  insert into public.hp_sequence_enrollments(sequence_id,contact_id,site_id,next_send_at)
  values(p_sequence,p_contact,p_site,now()) on conflict(site_id,sequence_id,contact_id) do nothing returning id into v_id;
  return jsonb_build_object('ok',true,'enrolled',v_id is not null,'enrollment_id',v_id);
end $$;

create or replace function public.laruhp_sequence_set_active(p_site uuid,p_owner uuid,p_sequence text,p_active boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  update public.hp_sequences set active=p_active,updated_at=now()
  where site_id=p_site and user_id=p_owner and id=p_sequence and deleted_at is null;
  if not found then return jsonb_build_object('ok',false,'reason','not_found'); end if;
  if not p_active then
    update public.hp_sequence_enrollments set state='cancelled',updated_at=now()
    where site_id=p_site and sequence_id=p_sequence and state='queued';
  end if;
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.laruhp_sequence_delete(p_site uuid,p_owner uuid,p_sequence text)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  update public.hp_sequences set active=false,deleted_at=now(),updated_at=now()
  where site_id=p_site and user_id=p_owner and id=p_sequence and deleted_at is null;
  if not found then return jsonb_build_object('ok',false,'reason','not_found'); end if;
  update public.hp_sequence_enrollments set state='cancelled',updated_at=now()
  where site_id=p_site and sequence_id=p_sequence and state='queued';
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.laruhp_sequence_finish(p_enrollment uuid,p_claim uuid,p_success boolean,p_provider_id text default null,p_error text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_row public.hp_sequence_enrollments%rowtype; v_steps jsonb; v_next integer; v_delay integer; v_attempt integer;
begin
  select e.* into v_row from public.hp_sequence_enrollments e where e.id=p_enrollment for update;
  if not found or v_row.state<>'processing' or v_row.claim_token is distinct from p_claim then return jsonb_build_object('ok',false,'reason','stale_claim'); end if;
  if p_success then
    if nullif(p_provider_id,'') is null then raise exception 'provider_id_required'; end if;
    insert into public.hp_sequence_deliveries(enrollment_id,step_index,provider_email_id) values(v_row.id,v_row.step_index,p_provider_id)
      on conflict(enrollment_id,step_index) do nothing;
    select steps into v_steps from public.hp_sequences where site_id=v_row.site_id and id=v_row.sequence_id and active and deleted_at is null;
    v_next:=v_row.step_index+1;
    if v_steps is null or v_next>=jsonb_array_length(v_steps) then
      update public.hp_sequence_enrollments set state='completed',claim_token=null,claimed_at=null,last_error=null,updated_at=now() where id=v_row.id;
    else
      v_delay:=greatest(0,least(8760,coalesce((v_steps->v_next->>'delay')::integer,0)));
      update public.hp_sequence_enrollments set state='queued',step_index=v_next,next_send_at=now()+make_interval(hours=>v_delay),attempt_count=0,claim_token=null,claimed_at=null,last_error=null,updated_at=now() where id=v_row.id;
    end if;
  else
    v_attempt:=v_row.attempt_count+1;
    update public.hp_sequence_enrollments set state=case when v_attempt>=5 then 'failed' else 'queued' end,
      attempt_count=v_attempt,next_send_at=now()+make_interval(mins=>(15*power(2,least(v_attempt-1,4)))::integer),
      claim_token=null,claimed_at=null,last_error=left(coalesce(p_error,'send_failed'),500),updated_at=now() where id=v_row.id;
  end if;
  return jsonb_build_object('ok',true,'state',(select state from public.hp_sequence_enrollments where id=v_row.id));
end $$;

revoke all on function public.laruhp_sequence_enroll(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.laruhp_sequence_enroll_specific(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.laruhp_sequence_set_active(uuid,uuid,text,boolean) from public,anon,authenticated;
revoke all on function public.laruhp_sequence_delete(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.laruhp_sequence_claim(integer) from public,anon,authenticated;
revoke all on function public.laruhp_sequence_finish(uuid,uuid,boolean,text,text) from public,anon,authenticated;
grant execute on function public.laruhp_sequence_enroll(uuid,uuid,text) to service_role;
grant execute on function public.laruhp_sequence_enroll_specific(uuid,uuid,text) to service_role;
grant execute on function public.laruhp_sequence_set_active(uuid,uuid,text,boolean) to service_role;
grant execute on function public.laruhp_sequence_delete(uuid,uuid,text) to service_role;
grant execute on function public.laruhp_sequence_claim(integer) to service_role;
grant execute on function public.laruhp_sequence_finish(uuid,uuid,boolean,text,text) to service_role;
