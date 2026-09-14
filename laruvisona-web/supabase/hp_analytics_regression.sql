\echo '--- A/B閲覧 ---'
do $$
declare
  owner_id uuid := '10000000-0000-4000-8000-000000000130';
  v_site_id uuid := '20000000-0000-4000-8000-000000000130';
  n integer := 0;
begin
  insert into auth.users(id) values(owner_id);
  insert into public.sites(id,user_id,name,slug,published,settings_json)
  values(v_site_id,owner_id,'分析回帰','analytics-regression',true,'{"keep":"value"}'::jsonb);
  if not public.laruhp_ab_increment('analytics-regression','a') then raise exception 'first increment failed'; end if; n:=n+1;
  if not public.laruhp_ab_increment('analytics-regression','a') then raise exception 'second increment failed'; end if; n:=n+1;
  if not public.laruhp_ab_increment('analytics-regression','b') then raise exception 'variant isolation failed'; end if; n:=n+1;
  if (select settings_json#>>'{abStats,a}' from public.sites where id=v_site_id)<>'2' then raise exception 'A count mismatch'; end if; n:=n+1;
  if (select settings_json#>>'{abStats,b}' from public.sites where id=v_site_id)<>'1' then raise exception 'B count mismatch'; end if; n:=n+1;
  if (select settings_json->>'keep' from public.sites where id=v_site_id)<>'value' then raise exception 'unrelated settings lost'; end if; n:=n+1;
  if public.laruhp_ab_increment('missing-site','a') then raise exception 'missing site accepted'; end if; n:=n+1;
  update public.sites set published=false where id=v_site_id;
  if public.laruhp_ab_increment('analytics-regression','a') then raise exception 'draft site accepted'; end if; n:=n+1;
  if public.laruhp_ab_increment('analytics-regression','c') then raise exception 'invalid variant accepted'; end if; n:=n+1;
  if n<>9 then raise exception 'assertion count mismatch: %',n; end if;
  raise notice 'A/B閲覧: %項目 OK',n;
end $$;
