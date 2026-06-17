-- ============================================================
-- LARUvisona HP Builder — Supabase Schema
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

-- profiles (extends auth.users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  business_name text,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  subscription_status text not null default 'inactive'
    check (subscription_status in ('inactive','trialing','active','past_due','canceled')),
  contract_starts_at timestamptz,
  contract_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- sites
create table if not exists public.sites (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null default 'マイサイト',
  slug text unique,
  industry text,
  blocks_json jsonb not null default '[]',
  seo_json jsonb not null default '{"title":"","description":"","keywords":"","ogTitle":"","ogDescription":""}',
  settings_json jsonb not null default '{"colorScheme":"professional-blue","style":"modern","larubot":true,"laruseo":true}',
  published boolean not null default false,
  published_html text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Triggers ──────────────────────────────────────────────────

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Auto-update updated_at
create or replace function public.update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger sites_updated_at before update on public.sites
  for each row execute procedure public.update_updated_at();

create trigger profiles_updated_at before update on public.profiles
  for each row execute procedure public.update_updated_at();

-- ── Row Level Security ────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.sites enable row level security;

-- profiles policies
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- sites policies
create policy "sites_select_own" on public.sites
  for select using (auth.uid() = user_id);
create policy "sites_insert_own" on public.sites
  for insert with check (auth.uid() = user_id);
create policy "sites_update_own" on public.sites
  for update using (auth.uid() = user_id);
create policy "sites_delete_own" on public.sites
  for delete using (auth.uid() = user_id);

-- Anyone can view published sites (for /hp/[slug] route)
create policy "sites_select_published" on public.sites
  for select using (published = true);

-- ── Indexes ───────────────────────────────────────────────────
create index if not exists sites_user_id_idx on public.sites (user_id);
create index if not exists sites_slug_idx on public.sites (slug) where slug is not null;
create index if not exists sites_published_idx on public.sites (published) where published = true;

-- ── Migrations ────────────────────────────────────────────────
-- Run these if adding features after initial setup

-- Page view count
alter table public.sites add column if not exists view_count bigint not null default 0;

-- Custom domain
alter table public.sites add column if not exists custom_domain text unique;
create index if not exists sites_custom_domain_idx on public.sites (custom_domain) where custom_domain is not null;

-- RPC: increment view count (bypasses RLS via security definer)
create or replace function public.increment_view_count(site_slug text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.sites set view_count = view_count + 1
  where slug = site_slug and published = true;
end;
$$;

create or replace function public.increment_view_count_by_domain(site_domain text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.sites set view_count = view_count + 1
  where custom_domain = site_domain and published = true;
end;
$$;

-- Admin: feature flags and account suspension
alter table public.profiles add column if not exists features jsonb not null default '{"builder":true,"publish":true,"ai":true}'::jsonb;
alter table public.profiles add column if not exists is_suspended boolean not null default false;
alter table public.profiles add column if not exists admin_notes text;

-- Daily page views (analytics graph)
create table if not exists public.daily_views (
  id bigint generated always as identity primary key,
  site_id uuid references public.sites(id) on delete cascade not null,
  date date not null default current_date,
  views bigint not null default 0,
  unique(site_id, date)
);
alter table public.daily_views enable row level security;
create policy "Users see own daily_views" on public.daily_views
  for select using (
    site_id in (select id from public.sites where user_id = auth.uid())
  );

-- Updated RPCs: increment total + daily view counts
create or replace function public.increment_view_count(site_slug text)
returns void language plpgsql security definer set search_path = public as $$
declare v_site_id uuid;
begin
  select id into v_site_id from public.sites where slug = site_slug and published = true;
  if v_site_id is null then return; end if;
  update public.sites set view_count = view_count + 1 where id = v_site_id;
  insert into public.daily_views (site_id, date, views)
  values (v_site_id, current_date, 1)
  on conflict (site_id, date) do update set views = public.daily_views.views + 1;
end;
$$;

create or replace function public.increment_view_count_by_domain(site_domain text)
returns void language plpgsql security definer set search_path = public as $$
declare v_site_id uuid;
begin
  select id into v_site_id from public.sites where custom_domain = site_domain and published = true;
  if v_site_id is null then return; end if;
  update public.sites set view_count = view_count + 1 where id = v_site_id;
  insert into public.daily_views (site_id, date, views)
  values (v_site_id, current_date, 1)
  on conflict (site_id, date) do update set views = public.daily_views.views + 1;
end;
$$;

-- contacts: form submissions (contact + booking)
create table if not exists public.contacts (
  id uuid default gen_random_uuid() primary key,
  site_id uuid references public.sites(id) on delete cascade not null,
  type text not null default 'contact' check (type in ('contact','booking')),
  name text not null,
  email text not null,
  phone text,
  message text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.contacts enable row level security;
create policy "Users see own contacts" on public.contacts
  for select using (
    site_id in (select id from public.sites where user_id = auth.uid())
  );
create policy "Users update own contacts" on public.contacts
  for update using (
    site_id in (select id from public.sites where user_id = auth.uid())
  );
create index if not exists contacts_site_id_idx on public.contacts (site_id);
create index if not exists contacts_created_at_idx on public.contacts (created_at desc);

-- site_versions: version history
create table if not exists public.site_versions (
  id uuid default gen_random_uuid() primary key,
  site_id uuid references public.sites(id) on delete cascade not null,
  label text,
  blocks_json jsonb not null default '[]',
  seo_json jsonb not null default '{}',
  settings_json jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.site_versions enable row level security;
create policy "Users see own versions" on public.site_versions
  for select using (
    site_id in (select id from public.sites where user_id = auth.uid())
  );
create index if not exists site_versions_site_id_idx on public.site_versions (site_id, created_at desc);

-- referrals: referral program
create table if not exists public.referrals (
  id uuid default gen_random_uuid() primary key,
  referrer_id uuid references auth.users on delete cascade not null,
  code text unique not null,
  uses integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.referrals enable row level security;
create policy "Users see own referrals" on public.referrals
  for select using (referrer_id = auth.uid());

-- newsletter_subscribers
create table if not exists public.newsletter_subscribers (
  id uuid default gen_random_uuid() primary key,
  site_id uuid references public.sites(id) on delete cascade not null,
  email text not null,
  name text,
  subscribed_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  unique(site_id, email)
);
alter table public.newsletter_subscribers enable row level security;
create policy "Users see own subscribers" on public.newsletter_subscribers
  for select using (
    site_id in (select id from public.sites where user_id = auth.uid())
  );
