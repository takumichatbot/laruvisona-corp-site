\echo '--- デジタルポイントカード ---'
do $$
declare owner_id uuid := '10000000-0000-4000-8000-000000000007';
declare other_id uuid := '10000000-0000-4000-8000-000000000008';
declare site_id uuid := '20000000-0000-4000-8000-000000000007';
declare card_id uuid := '30000000-0000-4000-8000-000000000007';
declare result jsonb;
declare saved jsonb;
begin
  insert into auth.users(id) values(owner_id),(other_id);
  insert into public.sites(id,user_id,name,slug,settings_json)
    values(site_id,owner_id,'ポイント店','loyalty-shop','{"unrelated":{"keep":true}}'::jsonb);
  insert into public.loyalty_cards(id,site_id,customer_name,stamps,max_stamps,reward,public_token_hash)
    values(card_id,site_id,'利用者',0,2,'特典','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');

  result := public.laruhp_loyalty_configure(site_id,owner_id,'{"maxStamps":8,"reward":"特典","cardName":"カード"}'::jsonb);
  if result->>'ok' <> 'true' then raise exception 'configuration failed'; end if;
  select settings_json into saved from public.sites where id=site_id;
  if saved#>>'{unrelated,keep}' <> 'true' or saved#>>'{loyalty_config,maxStamps}' <> '8' then
    raise exception 'configuration replaced unrelated settings: %', saved;
  end if;

  result := public.laruhp_loyalty_add_stamp(card_id,owner_id);
  if result->>'stamps' <> '1' or result->>'completed' <> 'false' then raise exception 'first stamp failed: %', result; end if;
  result := public.laruhp_loyalty_add_stamp(card_id,owner_id);
  if result->>'stamps' <> '2' or result->>'completed' <> 'true' then raise exception 'completion failed: %', result; end if;
  result := public.laruhp_loyalty_add_stamp(card_id,owner_id);
  if result->>'stamps' <> '2' then raise exception 'stamp exceeded maximum: %', result; end if;

  begin
    perform public.laruhp_loyalty_add_stamp(card_id,other_id);
    raise exception 'other owner changed card';
  exception when raise_exception then
    if sqlerrm <> 'card_not_found' then raise; end if;
  end;

  if has_table_privilege('anon','public.loyalty_cards','SELECT')
     or has_table_privilege('authenticated','public.loyalty_cards','SELECT') then
    raise exception 'card table exposed';
  end if;
  if has_function_privilege('anon','public.laruhp_loyalty_add_stamp(uuid,uuid)','EXECUTE')
     or has_function_privilege('authenticated','public.laruhp_loyalty_configure(uuid,uuid,jsonb)','EXECUTE') then
    raise exception 'loyalty RPC exposed';
  end if;
end $$;
\echo 'デジタルポイントカード: 10項目 OK'
