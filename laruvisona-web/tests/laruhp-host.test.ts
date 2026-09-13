import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { proxy } from '../proxy';
import { isReservedHost } from '../lib/domain';
import { initialComposition } from '../lib/studio-composition';
import { compositionTransferUrl, parseCompositionTransfer } from '../lib/composition-transfer';
import { LARUHP_PUBLIC_PATHS } from '../lib/laruhp-public';
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
test('案内・業種・記事・料金・法的ページは専用ドメインで配信する', async () => {
  for (const [path, internal] of [
    ['/articles', '/laruHP/articles'],
    ['/articles/hp-sakusei-cost', '/laruHP/articles/hp-sakusei-cost'],
    ['/beauty', '/laruHP/beauty'],
    ['/plans', '/laruHP/plans'],
    ['/contact', '/laruHP/contact'],
    ['/privacy', '/laruHP/privacy'],
  ]) {
    const res = await proxy(req(`${path}?from=search`));
    assert.equal(res.headers.get('x-middleware-rewrite'), `https://laruhp.com${internal}?from=search`);
  }
});
test('OGP画像も専用ドメインから配信する', async () => {
  const res = await proxy(req('/opengraph-image'));
  assert.equal(res.headers.get('x-middleware-rewrite'), 'https://laruhp.com/laruHP/opengraph-image');
});
test('素材は配信し、サイトマップはサービスのURLだけを載せる', async () => {
  for (const path of ['/lp/film/flow-mobile.mp4', '/studio/references/cafe-v1.webp', '/salon/hero-900.avif', '/indexnow-key.txt', '/_next/image']) assert.equal((await proxy(req(path))).headers.get('x-middleware-next'), '1');
  const sitemap = await (await proxy(req('/sitemap.xml'))).text();
  for (const path of LARUHP_PUBLIC_PATHS) assert.match(sitemap, new RegExp(`<loc>https://laruhp\\.com${path.replaceAll('/', '\\/')}</loc>`));
  assert.doesNotMatch(sitemap, /opengraph-image/);
  assert.doesNotMatch(sitemap, /laruvisona\.jp|\/laruHP\//);
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

test('会社側に残る旧公開URLを専用ドメインへ308転送し、クエリを保持する', async () => {
  for (const host of ['laruvisona.jp', 'www.laruvisona.jp']) {
    for (const [path, target] of [
      ['/laruHP', '/'],
      ['/laruHP/', '/'],
      ['/laruHP/articles', '/articles'],
      ['/laruHP/articles/hp-sakusei-cost', '/articles/hp-sakusei-cost'],
      ['/laruHP/beauty', '/beauty'],
      ['/laruHP/plans', '/plans'],
    ]) {
      for (const method of ['GET', 'HEAD']) {
        const res = await proxy(req(path + '?utm_source=google', host, method));
        assert.equal(res.status, 308);
        assert.equal(res.headers.get('location'), `https://laruhp.com${target}?utm_source=google`);
        assert.equal(res.headers.get('x-middleware-rewrite'), null);
      }
    }
  }
});

test('料金ページは専用ドメインで配信し、会社側の旧URLだけを308転送する', async () => {
  const own = await proxy(req('/plans', 'laruhp.com'));
  assert.equal(own.headers.get('x-middleware-rewrite'), 'https://laruhp.com/laruHP/plans');
  const legacy = await proxy(req('/plans?from=old', 'laruvisona.jp'));
  assert.equal(legacy.status, 308);
  assert.equal(legacy.headers.get('location'), 'https://laruhp.com/plans?from=old');
});
