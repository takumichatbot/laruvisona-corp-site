-- Harden first-party analytics storage. Existing rows remain available through the owner API.
begin;
create table if not exists public.heatmap_events(
 id bigint generated always as identity primary key,site_id uuid not null references public.sites(id) on delete cascade,
 event_type text not null check(event_type in ('click','scroll')),x integer,y integer,scroll_depth integer,
 path text not null,viewport_w integer not null,viewport_h integer not null,session_id uuid,created_at timestamptz not null default now()
);
alter table public.heatmap_events add column if not exists session_id uuid;
create index if not exists heatmap_events_lookup on public.heatmap_events(site_id,path,event_type,created_at desc);
alter table public.heatmap_events enable row level security;
revoke all on public.heatmap_events from public,anon,authenticated;
grant all on public.heatmap_events to service_role;
create or replace function public.laruhp_ab_increment(p_slug text,p_variant text)
returns boolean language plpgsql security definer set search_path=public as $$
declare current_count bigint;
begin
 if p_slug is null or length(p_slug)>160 or p_variant not in ('a','b') then return false; end if;
 select case when settings_json#>>array['abStats',p_variant] ~ '^[0-9]+$'
   then (settings_json#>>array['abStats',p_variant])::bigint else 0 end
 into current_count from public.sites where slug=p_slug and published for update;
 if not found then return false; end if;
 update public.sites set settings_json=coalesce(settings_json,'{}'::jsonb)||jsonb_build_object(
   'abStats',coalesce(settings_json->'abStats','{}'::jsonb)||jsonb_build_object(p_variant,current_count+1)
 ) where slug=p_slug and published;
 return found;
end $$;
revoke all on function public.increment_view_count(text),public.increment_view_count_by_domain(text) from public,anon,authenticated;
grant execute on function public.increment_view_count(text),public.increment_view_count_by_domain(text) to service_role;
revoke all on function public.laruhp_ab_increment(text,text) from public,anon,authenticated;
grant execute on function public.laruhp_ab_increment(text,text) to service_role;
commit;
