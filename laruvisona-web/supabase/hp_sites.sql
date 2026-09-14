-- Site creation is a paid-plan boundary. Keep the count and insert in one
-- database transaction, and do not let browser clients bypass the API.
revoke insert on public.sites from public, anon, authenticated;
grant insert on public.sites to service_role;

create or replace function public.laruhp_create_site(
  p_user uuid,
  p_limit integer,
  p_name text,
  p_slug text,
  p_industry text,
  p_blocks jsonb,
  p_seo jsonb,
  p_settings jsonb
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  existing_count integer;
  created public.sites;
begin
  if p_user is null or p_limit is null or p_limit<1 or p_limit>999
     or p_name is null or length(p_name)<1 or length(p_name)>120
     or p_slug is null or p_slug !~ '^[a-z0-9ぁ-ん一-龯]([a-z0-9ぁ-ん一-龯-]{0,58}[a-z0-9ぁ-ん一-龯])?$'
     or p_industry is not null and length(p_industry)>80
     or jsonb_typeof(p_blocks)<>'array' or jsonb_typeof(p_seo)<>'object'
     or jsonb_typeof(p_settings)<>'object' then
    raise exception 'invalid_site_input';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  select count(*) into existing_count from public.sites where user_id=p_user;
  if existing_count>=p_limit then
    return jsonb_build_object('ok',false,'reason','site_limit','count',existing_count,'limit',p_limit);
  end if;

  insert into public.sites(user_id,name,slug,industry,blocks_json,seo_json,settings_json)
  values(p_user,p_name,p_slug,p_industry,p_blocks,p_seo,p_settings)
  returning * into created;
  return jsonb_build_object('ok',true,'site',to_jsonb(created));
end $$;

revoke all on function public.laruhp_create_site(uuid,integer,text,text,text,jsonb,jsonb,jsonb)
  from public,anon,authenticated;
grant execute on function public.laruhp_create_site(uuid,integer,text,text,text,jsonb,jsonb,jsonb)
  to service_role;
