\echo '--- サイト作成上限 ---'
do $$
declare
  owner_id uuid := '91000000-0000-4000-8000-000000000001';
  result jsonb;
  n integer := 0;
begin
  insert into auth.users(id) values(owner_id);
  result:=public.laruhp_create_site(owner_id,1,'一号店','atomic-site-1',null,'[]','{}','{}');
  if result->>'ok'<>'true' then raise exception 'first site was rejected'; end if; n:=n+1;
  result:=public.laruhp_create_site(owner_id,1,'二号店','atomic-site-2',null,'[]','{}','{}');
  if result->>'reason'<>'site_limit' then raise exception 'limit was bypassed'; end if; n:=n+1;
  if (select count(*) from public.sites where user_id=owner_id)<>1 then raise exception 'extra site was inserted'; end if; n:=n+1;
  if has_table_privilege('authenticated','public.sites','INSERT') then raise exception 'authenticated can insert directly'; end if; n:=n+1;
  if has_table_privilege('anon','public.sites','INSERT') then raise exception 'anon can insert directly'; end if; n:=n+1;
  if has_function_privilege('authenticated','public.laruhp_create_site(uuid,integer,text,text,text,jsonb,jsonb,jsonb)','EXECUTE') then raise exception 'authenticated can call creation RPC'; end if; n:=n+1;
  if not has_function_privilege('service_role','public.laruhp_create_site(uuid,integer,text,text,text,jsonb,jsonb,jsonb)','EXECUTE') then raise exception 'service role cannot create'; end if; n:=n+1;
  begin
    perform public.laruhp_create_site(owner_id,999,'不正','bad-site',null,'{}','{}','{}');
    raise exception 'invalid blocks were accepted';
  exception when others then
    if sqlerrm<>'invalid_site_input' then raise; end if;
  end; n:=n+1;
  if n<>8 then raise exception 'assertion count mismatch: %',n; end if;
  raise notice 'サイト作成上限: %項目 OK',n;
end $$;
