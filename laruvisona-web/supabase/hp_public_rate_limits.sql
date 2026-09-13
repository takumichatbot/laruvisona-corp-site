-- Public form limits shared by every application instance.
-- Only an HMAC digest is stored; raw IP addresses never enter this table.
create table if not exists public.hp_public_rate_limits (
  key_hash text not null check(key_hash ~ '^[0-9a-f]{64}$'),
  scope text not null check(scope ~ '^[a-z0-9-]{1,40}$'),
  window_start timestamptz not null,
  used integer not null default 1 check(used between 1 and 1000),
  updated_at timestamptz not null default now(),
  primary key(key_hash,scope,window_start)
);

alter table public.hp_public_rate_limits enable row level security;
revoke all on public.hp_public_rate_limits from public,anon,authenticated;
grant all on public.hp_public_rate_limits to service_role;

drop function if exists public.laruhp_public_claim_rate(text,text,integer);
create or replace function public.laruhp_public_claim_rate(
  p_key_hash text,p_scope text,p_limit integer,p_window_seconds integer
) returns boolean language plpgsql security definer set search_path=public as $$
declare bucket timestamptz; claimed integer;
begin
  if p_key_hash is null or p_key_hash !~ '^[0-9a-f]{64}$'
     or p_scope is null or p_scope !~ '^[a-z0-9-]{1,40}$'
     or p_limit is null or p_limit<1 or p_limit>1000
     or p_window_seconds is null or p_window_seconds<60 or p_window_seconds>86400 then
    raise exception 'invalid_rate_limit';
  end if;
  bucket:=to_timestamp(floor(extract(epoch from now())/p_window_seconds)*p_window_seconds);
  insert into hp_public_rate_limits(key_hash,scope,window_start,used)
  values(p_key_hash,p_scope,bucket,1)
  on conflict(key_hash,scope,window_start) do update
    set used=hp_public_rate_limits.used+1,updated_at=now()
    where hp_public_rate_limits.used<p_limit
  returning used into claimed;
  delete from hp_public_rate_limits where window_start<now()-interval '2 days';
  return claimed is not null;
end $$;

revoke all on function public.laruhp_public_claim_rate(text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.laruhp_public_claim_rate(text,text,integer,integer) to service_role;
