import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cartFromMetadata, cartMetadata, normalizeShopCart, snapshotStripeItems } from '../lib/shop-order.ts';

test('カートは重複商品をまとめ、数量と件数の上限を守る', () => {
  assert.deepEqual(normalizeShopCart([
    { productId: 'p-1', variantId: 'red', quantity: 2 },
    { productId: 'p-1', variantId: 'red', quantity: 3 },
  ]), [{ id: 'p-1', v: 'red', q: 5 }]);
  assert.throws(() => normalizeShopCart([{ productId: 'p-1', quantity: 100 }]));
  assert.throws(() => normalizeShopCart(Array.from({ length: 21 }, (_, i) => ({ productId: `p-${i}`, quantity: 1 }))));
});

test('長いカートもStripe metadataから欠落せず復元できる', () => {
  const cart = normalizeShopCart(Array.from({ length: 20 }, (_, i) => ({
    productId: `product_${String(i).padStart(2, '0')}_${'x'.repeat(45)}`,
    variantId: `variant_${String(i).padStart(2, '0')}_${'y'.repeat(40)}`,
    quantity: i % 3 + 1,
  })));
  const metadata = cartMetadata(cart);
  assert.ok(Number(metadata.laru_cart_parts) > 1);
  assert.ok(Object.values(metadata).every(value => value.length <= 450));
  assert.deepEqual(cartFromMetadata(metadata), cart);
});

test('旧metadataも読み、壊れた分割情報は注文にしない', () => {
  assert.deepEqual(cartFromMetadata({ laru_cart: '[{"id":"p1","q":2}]' }), [{ id: 'p1', q: 2 }]);
  assert.deepEqual(cartFromMetadata({ laru_product_id: 'p1' }), [{ id: 'p1', q: 1 }]);
  assert.throws(() => cartFromMetadata({ laru_cart_parts: '2', laru_cart_0: '[{"id":"p1"' }));
});

test('Stripeの確定明細とカートの数量・金額を照合する', () => {
  const items = snapshotStripeItems(
    [{ id: 'p1', q: 2 }],
    [{ description: '焼き菓子セット', quantity: 2, amount_total: 2400 }],
  );
  assert.deepEqual(items, [{ name: '焼き菓子セット', variant: null, quantity: 2, unit: 1200 }]);
  assert.throws(() => snapshotStripeItems([{ id: 'p1', q: 2 }], [{ description: '商品', quantity: 1, amount_total: 1200 }]));
  assert.throws(() => snapshotStripeItems([{ id: 'p1', q: 2 }], []));
});

test('Webhookは先に在庫を減らさず、DBの原子的な注文確定を使う', () => {
  const webhook = readFileSync(new URL('../app/api/stripe/webhook/route.ts', import.meta.url), 'utf8');
  assert.match(webhook, /listLineItems\(session\.id/);
  assert.match(webhook, /rpc\('laruhp_shop_commit_order'/);
  assert.doesNotMatch(webhook, /from\('hp_orders'\)\.upsert/);
  assert.match(webhook, /if \(!result\.created\) break/);
  assert.match(webhook, /escapeContactHtml\(item\.name\)/);
});

test('注文確定SQLはサイトをロックし、重複確認後に在庫と注文を同じ関数で保存する', () => {
  const sql = readFileSync(new URL('../supabase/hp_orders.sql', import.meta.url), 'utf8');
  const lock = sql.indexOf('for update;');
  const duplicate = sql.indexOf('where stripe_session_id = p_stripe_session_id');
  const inventory = sql.indexOf("settings_json = jsonb_set");
  const insert = sql.indexOf('insert into public.hp_orders');
  assert.ok(lock > 0 && duplicate > lock && inventory > duplicate && insert > inventory);
  assert.match(sql, /status[\s\S]*'review'/);
  assert.match(sql, /grant execute on function public\.laruhp_shop_commit_order[\s\S]*to service_role/i);
});

test('Checkoutは公開サイトだけを扱い、カートmetadataを省略しない', () => {
  const checkout = readFileSync(new URL('../app/api/shop/checkout/route.ts', import.meta.url), 'utf8');
  assert.match(checkout, /\.eq\('published', true\)/);
  assert.match(checkout, /const encodedCart = cartMetadata\(cart\)/);
  assert.doesNotMatch(checkout, /cartJson\.length <=/);
});
