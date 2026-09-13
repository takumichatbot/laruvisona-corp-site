\echo '--- ショップ注文 ---'
do $$
declare owner_id uuid := '10000000-0000-4000-8000-000000000003';
declare other_id uuid := '10000000-0000-4000-8000-000000000004';
declare owner_site uuid := '20000000-0000-4000-8000-000000000003';
declare other_site uuid := '20000000-0000-4000-8000-000000000004';
begin
  insert into auth.users(id) values(owner_id),(other_id);
  insert into public.sites(id,user_id,name,slug,settings_json) values
    (owner_site,owner_id,'ショップ','shop-site','{"products":[{"id":"p1","name":"商品","active":true,"stock":5,"variants":[{"id":"v1","name":"赤","stock":3}]}]}'::jsonb),
    (other_site,other_id,'他人のショップ','other-shop','{}'::jsonb);

  perform public.laruhp_shop_commit_order(
    owner_site,'cs_first','購入者','buyer@example.test',null,2400,
    '[{"name":"商品","variant":null,"quantity":2,"unit":1200}]'::jsonb,null,
    '[{"id":"p1","q":2}]'::jsonb
  );
  perform public.laruhp_shop_commit_order(
    owner_site,'cs_first','購入者','buyer@example.test',null,2400,
    '[{"name":"商品","variant":null,"quantity":2,"unit":1200}]'::jsonb,null,
    '[{"id":"p1","q":2}]'::jsonb
  );
  perform public.laruhp_shop_commit_order(
    owner_site,'cs_review','購入者','buyer@example.test',null,4800,
    '[{"name":"商品","variant":null,"quantity":4,"unit":1200}]'::jsonb,null,
    '[{"id":"p1","q":4}]'::jsonb
  );
  perform public.laruhp_shop_commit_order(
    owner_site,'cs_variant','購入者','buyer@example.test',null,2600,
    '[{"name":"商品（赤）","variant":null,"quantity":2,"unit":1300}]'::jsonb,null,
    '[{"id":"p1","v":"v1","q":2}]'::jsonb
  );
  perform public.laruhp_shop_commit_order(
    other_site,'cs_other','別の購入者','other@example.test',null,1000,
    '[{"name":"別の商品","variant":null,"quantity":1,"unit":1000}]'::jsonb,null,
    '[{"id":"missing","q":1}]'::jsonb
  );
end $$;

do $$
declare n integer;
declare stock integer;
declare variant_stock integer;
begin
  select count(*) into n from public.hp_orders where stripe_session_id='cs_first';
  if n <> 1 then raise exception 'webhook replay created % orders', n; end if;
  select (settings_json#>>'{products,0,stock}')::integer,
         (settings_json#>>'{products,0,variants,0,stock}')::integer
    into stock,variant_stock from public.sites where slug='shop-site';
  if stock <> 3 then raise exception 'stock decremented more than once: %', stock; end if;
  if variant_stock <> 1 then raise exception 'variant stock expected 1, got %', variant_stock; end if;
  select count(*) into n from public.hp_orders where stripe_session_id='cs_review' and status='review';
  if n <> 1 then raise exception 'paid order requiring review was lost'; end if;
  if has_function_privilege('anon','public.laruhp_shop_commit_order(uuid,text,text,text,text,integer,jsonb,jsonb,jsonb)','EXECUTE') then
    raise exception 'anon can commit orders';
  end if;
  if has_function_privilege('authenticated','public.laruhp_shop_commit_order(uuid,text,text,text,text,integer,jsonb,jsonb,jsonb)','EXECUTE') then
    raise exception 'authenticated can commit orders';
  end if;
end $$;

set role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003"}',false);
do $$
declare n integer;
begin
  select count(*) into n from public.hp_orders;
  if n <> 3 then raise exception 'owner order visibility expected 3, got %', n; end if;
  begin
    update public.hp_orders set status='canceled' where stripe_session_id='cs_first';
    raise exception 'paid order was canceled without refund';
  exception when raise_exception then
    if sqlerrm <> 'invalid_order_transition' then raise; end if;
  end;
end $$;
reset role;
\echo 'ショップ注文: 10項目 OK'
