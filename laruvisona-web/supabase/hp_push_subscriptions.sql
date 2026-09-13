create table if not exists public.hp_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  subscription jsonb not null,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,endpoint),
  check(length(endpoint) between 12 and 2048),
  check(jsonb_typeof(subscription)='object')
);
alter table public.hp_push_subscriptions enable row level security;
drop policy if exists hp_push_own on public.hp_push_subscriptions;
create policy hp_push_own on public.hp_push_subscriptions for all
  using(user_id=auth.uid()) with check(user_id=auth.uid());
revoke all on public.hp_push_subscriptions from anon,authenticated;
grant select,insert,update,delete on public.hp_push_subscriptions to authenticated;
create index if not exists hp_push_user_active on public.hp_push_subscriptions(user_id) where disabled_at is null;

drop trigger if exists hp_push_updated_at on public.hp_push_subscriptions;
create trigger hp_push_updated_at before update on public.hp_push_subscriptions
for each row execute function public.update_updated_at();
