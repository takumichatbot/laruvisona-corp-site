-- Shared AI usage limits. These protect paid provider calls across all app instances.
begin;
create table if not exists public.hp_ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null,
  window_start timestamptz not null,
  used integer not null default 0 check (used>=0),
  updated_at timestamptz not null default now(),
  primary key(user_id,scope,window_start)
);
alter table public.hp_ai_usage enable row level security;
revoke all on public.hp_ai_usage from public,anon,authenticated;
grant all on public.hp_ai_usage to service_role;

create or replace function public.laruhp_ai_claim_usage(p_scope text,p_limit integer)
returns boolean language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); bucket timestamptz:=date_trunc('hour',now()); changed integer;
begin
  if actor is null then raise exception 'unauthorized'; end if;
  if p_scope !~ '^[a-z0-9_-]{1,40}$' or p_limit<1 or p_limit>100 then raise exception 'invalid_limit'; end if;
  insert into hp_ai_usage(user_id,scope,window_start,used)
  values(actor,p_scope,bucket,1)
  on conflict(user_id,scope,window_start) do update
    set used=hp_ai_usage.used+1,updated_at=now()
    where hp_ai_usage.used<p_limit;
  get diagnostics changed=row_count;
  delete from hp_ai_usage where window_start<now()-interval '7 days';
  return changed=1;
end $$;
revoke all on function public.laruhp_ai_claim_usage(text,integer) from public,anon;
grant execute on function public.laruhp_ai_claim_usage(text,integer) to authenticated,service_role;
commit;
