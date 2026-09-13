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
revoke all on function public.increment_view_count(text),public.increment_view_count_by_domain(text) from public,anon,authenticated;
grant execute on function public.increment_view_count(text),public.increment_view_count_by_domain(text) to service_role;
commit;
