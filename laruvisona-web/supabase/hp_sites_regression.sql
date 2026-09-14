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
  result:=public.laruhp_create_site(owner_id,2,'複数ページ','atomic-site-v2',null,
    '{"v":2,"pages":[]}'::jsonb,'{}','{}');
  if result->>'ok'<>'true' then raise exception 'v2 site was rejected'; end if; n:=n+1;
  if n<>9 then raise exception 'assertion count mismatch: %',n; end if;
  raise notice 'サイト作成上限: %項目 OK',n;
end $$;

set request.jwt.claims='{"role":"authenticated","sub":"91000000-0000-4000-8000-000000000001"}';
set role authenticated;
do $$
declare n integer:=0;
begin
  update public.sites set settings_json='{"draft":true}' where slug='atomic-site-1';
  if not exists(select 1 from public.sites where slug='atomic-site-1' and settings_json->>'draft'='true') then
    raise exception 'ordinary draft update was blocked';
  end if; n:=n+1;
  begin
    update public.sites set published=true,published_html='<script>globalThis.pwned=1</script>' where slug='atomic-site-1';
    raise exception 'direct publication was accepted';
  exception when others then
    if sqlerrm<>'site_publication_server_only' then raise; end if;
  end; n:=n+1;
  if exists(select 1 from public.sites where slug='atomic-site-1' and published) then
    raise exception 'direct publication changed the row';
  end if; n:=n+1;
  if n<>3 then raise exception 'assertion count mismatch: %',n; end if;
  raise notice '公開境界: %項目 OK',n;
end $$;
reset role;
reset request.jwt.claims;

set role service_role;
update public.sites set published=true,published_html='<!--safe-export-->' where slug='atomic-site-1';
reset role;
do $$ begin
  if not exists(select 1 from public.sites where slug='atomic-site-1' and published and published_html='<!--safe-export-->') then
    raise exception 'service publication was blocked';
  end if;
  raise notice 'サーバー公開: 1項目 OK';
end $$;
