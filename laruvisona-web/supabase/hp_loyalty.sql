-- LARU HP デジタルポイントカード
-- オーナー操作はサーバーから service_role 専用RPCを通す。
create table if not exists public.loyalty_cards (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  customer_name text not null,
  customer_phone text,
  stamps integer not null default 0,
  max_stamps integer not null default 10,
  reward text not null,
  card_name text not null default 'スタンプカード',
  public_token_hash text,
  last_stamped_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint loyalty_cards_stamp_range check (max_stamps between 1 and 50 and stamps between 0 and max_stamps)
);

alter table public.loyalty_cards add column if not exists public_token_hash text;
alter table public.loyalty_cards add column if not exists card_name text not null default 'スタンプカード';
alter table public.loyalty_cards add column if not exists last_stamped_at timestamptz;
alter table public.loyalty_cards add column if not exists completed_at timestamptz;
create index if not exists loyalty_cards_site_created_idx on public.loyalty_cards(site_id, created_at desc);
create unique index if not exists loyalty_cards_public_token_idx on public.loyalty_cards(public_token_hash) where public_token_hash is not null;

alter table public.loyalty_cards enable row level security;
revoke all on public.loyalty_cards from anon, authenticated;
grant all on public.loyalty_cards to service_role;

create or replace function public.laruhp_loyalty_configure(
  p_site uuid,
  p_owner uuid,
  p_config jsonb
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_site public.sites%rowtype;
begin
  if p_config is null or jsonb_typeof(p_config) <> 'object'
     or not (p_config ?& array['maxStamps','reward','cardName']) then
    raise exception 'invalid_config';
  end if;
  select * into v_site from public.sites where id=p_site and user_id=p_owner for update;
  if not found then raise exception 'site_not_found'; end if;
  update public.sites
    set settings_json=jsonb_set(coalesce(settings_json,'{}'::jsonb),'{loyalty_config}',p_config,true)
    where id=p_site;
  return jsonb_build_object('ok',true,'siteId',p_site);
end $$;

create or replace function public.laruhp_loyalty_add_stamp(
  p_card uuid,
  p_owner uuid
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_card public.loyalty_cards%rowtype;
begin
  select c.* into v_card
    from public.loyalty_cards c join public.sites s on s.id=c.site_id
    where c.id=p_card and s.user_id=p_owner
    for update of c;
  if not found then raise exception 'card_not_found'; end if;
  if v_card.stamps < v_card.max_stamps then
    update public.loyalty_cards
      set stamps=stamps+1,
          last_stamped_at=now(),
          completed_at=case when stamps+1 >= max_stamps then coalesce(completed_at,now()) else null end
      where id=p_card
      returning * into v_card;
  end if;
  return jsonb_build_object(
    'ok',true,'stamps',v_card.stamps,'maxStamps',v_card.max_stamps,
    'completed',v_card.stamps >= v_card.max_stamps,
    'reward',case when v_card.stamps >= v_card.max_stamps then v_card.reward else null end
  );
end $$;

revoke all on function public.laruhp_loyalty_configure(uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.laruhp_loyalty_add_stamp(uuid,uuid) from public,anon,authenticated;
grant execute on function public.laruhp_loyalty_configure(uuid,uuid,jsonb) to service_role;
grant execute on function public.laruhp_loyalty_add_stamp(uuid,uuid) to service_role;
