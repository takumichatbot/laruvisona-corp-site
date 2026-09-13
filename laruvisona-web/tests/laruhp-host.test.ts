import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { proxy } from '../proxy';
import { isReservedHost } from '../lib/domain';
import { initialComposition } from '../lib/studio-composition';
import { compositionTransferUrl, parseCompositionTransfer } from '../lib/composition-transfer';
const req = (path: string, host = 'laruhp.com', method = 'GET') => new NextRequest(`https://${host}${path}`, { headers: { host }, method });
test('専用ドメインの入口とクエリをLPへ、wwwは同じパスで正規化', async () => {
  const res = await proxy(req('/?utm_source=domain'));
  assert.equal(res.headers.get('x-middleware-rewrite'), 'https://laruhp.com/laruHP?utm_source=domain');
  for (const path of ['/', '/laruHP']) assert.equal((await proxy(req(path, 'www.laruhp.com'))).headers.get('location'), 'https://laruhp.com/');
});
test('ログイン・制作は既存origin、APIへの書込みと顧客ページは配信しない', async () => {
  assert.equal((await proxy(req('/laruHP/studio?creation=a'))).headers.get('location'), 'https://laruvisona.jp/laruHP/studio?creation=a');
  assert.equal((await proxy(req('/laruHP/auth/login'))).headers.get('location'), 'https://laruvisona.jp/laruHP/auth/login');
  for (const path of ['/api/contact', '/hp/other', '/brand', '/missing']) assert.equal((await proxy(req(path))).status, 404);
  assert.equal((await proxy(req('/api/contact', 'laruhp.com', 'POST'))).status, 405);
});
test('素材は配信し、サイトマップはサービスのURLだけを載せる', async () => {
  for (const path of ['/lp/film/flow-mobile.mp4', '/studio/references/cafe-v1.webp', '/salon/hero-900.avif', '/_next/image']) assert.equal((await proxy(req(path))).headers.get('x-middleware-next'), '1');
  assert.match(await (await proxy(req('/sitemap.xml'))).text(), /<loc>https:\/\/laruhp.com\/<\/loc>/);
  assert.match(await (await proxy(req('/robots.txt'))).text(), /https:\/\/laruhp.com\/sitemap.xml/);
  assert.equal(isReservedHost('laruhp.com'), true);
  assert.equal(isReservedHost('www.laruhp.com'), true);
});
test('デモの日本語・写真・見せ方を期限つきで引き継ぐ', () => {
  const value = {...initialComposition('restaurant'), name: '喫茶と本', heading: '今日の一杯。'};
  const url = new URL(compositionTransferUrl(value, 1000));
  assert.equal(url.origin, 'https://laruvisona.jp');
  assert.equal(url.search, '');
  assert.deepEqual(parseCompositionTransfer(url.hash, 1000), value);
  assert.equal(parseCompositionTransfer(url.hash, 7201001), null);
  assert.equal(parseCompositionTransfer('#creation=%ZZ'), null);
  assert.equal(parseCompositionTransfer('#creation=' + 'x'.repeat(12001)), null);
  assert.equal(parseCompositionTransfer('#creation='+encodeURIComponent(JSON.stringify({at:1000,choice:{...value,photo:'https://evil.test'}})),1000), null);
});
