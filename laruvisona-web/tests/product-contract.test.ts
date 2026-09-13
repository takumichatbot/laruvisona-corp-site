import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseNewProduct } from '../lib/product-contract.ts';

test('商品は価格・在庫・選択肢を販売可能な範囲に整える', () => {
  const product = parseNewProduct({
    name: ' 焼き菓子 ', description: ' 説明 ', price: 1200, stock: 5, category: '商品',
    variantLabel: ' サイズ ', variants: [{ id: 'small', name: ' 小 ', priceDelta: -200, stock: 2 }],
  });
  assert.equal(product.name, '焼き菓子');
  assert.equal(product.price, 1200);
  assert.equal(product.variants?.[0].priceDelta, -200);
  assert.equal(product.variants?.[0].stock, 2);
  assert.throws(() => parseNewProduct({ name: 'x', price: 49 }));
  assert.throws(() => parseNewProduct({ name: 'x', price: 100, stock: -1 }));
  assert.throws(() => parseNewProduct({ name: 'x', price: 100, variants: [{ name: '赤', priceDelta: -51 }] }));
});

test('商品APIは所有者・同時更新・DB失敗を扱い、更新項目を販売状態に限定する', () => {
  const api = readFileSync(new URL('../app/api/products/route.ts', import.meta.url), 'utf8');
  assert.match(api, /\.eq\('user_id', userId\)/);
  assert.match(api, /\.eq\('updated_at', current\.data\.updated_at\)/);
  assert.match(api, /for \(let attempt = 0; attempt < 4; attempt\+\+\)/);
  assert.match(api, /typeof body\.active !== 'boolean'/);
  assert.doesNotMatch(api, /\.\.\.updates, id: productId/);
  assert.match(api, /if \(saved\.error\) return databaseError\(\)/);
});

test('ショップ画面は設定をAPIで保存し、絵文字とブラウザからの直接DB更新を使わない', () => {
  const page = readFileSync(new URL('../app/laruHP/shop/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /settings_patch: \{ shopCollectShipping: val \}/);
  assert.doesNotMatch(page, /createClient\(\)|from\('sites'\)/);
  assert.doesNotMatch(page, /🗑️|🛍️|⚠️/u);
});
