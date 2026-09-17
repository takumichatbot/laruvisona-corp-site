-- 返金・キャンセルしたら、在庫を戻す。
--
-- 2026-09-17時点で、在庫を減らす所（laruhp_shop_commit_order）はあるのに、
-- **戻す所がどこにも無かった。**
--
-- 起きること:
--   ・店主が返金しても、公開ショップの在庫はその分だけ減ったまま
--   ・在庫1の商品なら「売り切れ」表示が続き、**売れる物が売れなくなる**
--   ・店には売れていない在庫が残る
--
-- 返金はステータスだけを見て進むので、数量のずれは棚と画面を
-- 突き合わせないと分からない。気づくのは「なぜか注文が来ない」と
-- 思ったあと、ずっと後になる。
--
-- 実行方法: Supabase の SQL Editor にこのファイルの中身を貼って実行する。
--   （関数が無いあいだも返金そのものは通る。アプリ側は「戻せなかった」
--     ことを記録に残して先へ進む作りにしてある）

-- 先に列を足す。関数が %rowtype でこの列を読むため。
--
-- cart（何をいくつ買ったか）は、これまで注文に残していなかった。
-- items には名前と数量しか無く、**商品のIDが入っていない。**
-- だから返金のときに「どの商品の在庫を戻すか」が特定できなかった。
alter table public.hp_orders add column if not exists cart jsonb;
-- 2回戻さないための印。
alter table public.hp_orders add column if not exists restocked boolean not null default false;

create or replace function public.laruhp_shop_restock_order(
  p_order_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.hp_orders%rowtype;
  v_settings jsonb;
  v_products jsonb;
  v_cart_item jsonb;
  v_product jsonb;
  v_variant jsonb;
  v_variants jsonb;
  v_product_pos integer;
  v_variant_pos integer;
  v_quantity integer;
  v_stock integer;
  v_restored integer := 0;
begin
  -- 注文と、そのサイトを同時に押さえる。
  -- 押さえないと、同じ瞬間の購入と足し戻しがぶつかって片方が消える。
  select * into v_order from public.hp_orders where id = p_order_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'order_not_found');
  end if;

  -- 2回押しても2回戻さない。戻したことを注文に書いておき、あればそこで終わる。
  if coalesce(v_order.restocked, false) then
    return jsonb_build_object('ok', true, 'reason', 'already_restocked', 'restored', 0);
  end if;

  -- 返金・キャンセルが済んでいる注文だけ。まだ売れている注文の在庫は戻さない。
  if v_order.status not in ('refunded', 'canceled') then
    return jsonb_build_object('ok', false, 'reason', 'not_refunded', 'status', v_order.status);
  end if;

  select coalesce(settings_json, '{}'::jsonb) into v_settings
    from public.sites where id = v_order.site_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'site_not_found');
  end if;

  v_products := coalesce(v_settings->'products', '[]'::jsonb);

  -- cart が無い注文（この列を足す前のもの）は、戻す先が分からない。
  -- 黙って「戻した」にはせず、そう答える。
  if v_order.cart is null or jsonb_typeof(v_order.cart) is distinct from 'array' then
    return jsonb_build_object('ok', false, 'reason', 'cart_missing');
  end if;

  for v_cart_item in select value from jsonb_array_elements(v_order.cart) loop
    begin v_quantity := (v_cart_item->>'q')::integer;
    exception when others then continue; end;
    if v_quantity is null or v_quantity < 1 then continue; end if;

    select value, ordinality::integer into v_product, v_product_pos
      from jsonb_array_elements(v_products) with ordinality
      where value->>'id' = v_cart_item->>'id'
      limit 1;
    -- 商品がもう無ければ、戻す先が無い。飛ばす（注文の記録は残る）
    if not found then continue; end if;

    if coalesce(v_cart_item->>'v', '') <> '' then
      v_variants := coalesce(v_product->'variants', '[]'::jsonb);
      select value, ordinality::integer into v_variant, v_variant_pos
        from jsonb_array_elements(v_variants) with ordinality
        where value->>'id' = v_cart_item->>'v'
        limit 1;
      if not found then continue; end if;
      -- 在庫を管理していない（stock が null）商品は、そのままにする。
      -- ここで 0 から足すと「無制限」を「在庫◯個」に変えてしまう。
      if v_variant->'stock' is not null and v_variant->'stock' <> 'null'::jsonb then
        begin v_stock := (v_variant->>'stock')::integer;
        exception when others then continue; end;
        v_variants := jsonb_set(v_variants, array[(v_variant_pos - 1)::text, 'stock'], to_jsonb(v_stock + v_quantity), false);
        v_product := jsonb_set(v_product, '{variants}', v_variants, false);
        v_products := jsonb_set(v_products, array[(v_product_pos - 1)::text], v_product, false);
        v_restored := v_restored + v_quantity;
      end if;
    elsif v_product->'stock' is not null and v_product->'stock' <> 'null'::jsonb then
      begin v_stock := (v_product->>'stock')::integer;
      exception when others then continue; end;
      v_products := jsonb_set(v_products, array[(v_product_pos - 1)::text, 'stock'], to_jsonb(v_stock + v_quantity), false);
      v_restored := v_restored + v_quantity;
    end if;
  end loop;

  update public.sites
    set settings_json = jsonb_set(v_settings, '{products}', v_products, true)
    where id = v_order.site_id;

  update public.hp_orders set restocked = true where id = v_order.id;

  return jsonb_build_object('ok', true, 'restored', v_restored);
end;
$$;

revoke all on function public.laruhp_shop_restock_order(uuid) from public;
grant execute on function public.laruhp_shop_restock_order(uuid) to service_role;
