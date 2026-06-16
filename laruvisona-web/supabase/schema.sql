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
