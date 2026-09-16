import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  organizationLd, organizationWithAreaLd, websiteLd, breadcrumbLd,
  serviceOffersLd, priceFrom, ORG_ID, AREAS_SERVED,
} from '../lib/organization-ld.ts';

test('会社の定義は1か所だけ', () => {
  // 以前は layout と /local に別々の Organization があり、中身が食い違っていた。
  for (const p of ['app/layout.tsx', 'app/local/page.tsx']) {
    const src = readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
    assert.match(src, /organization(Ld|WithAreaLd)\(/, p);
    assert.doesNotMatch(src, /'@type': 'Organization'/, `${p}: 自前で書いている`);
  }
});

test('指名検索で会社を言い当てられるだけの情報がある', () => {
  const o = organizationLd() as Record<string, unknown>;
  for (const key of ['name', 'legalName', 'url', 'logo', 'description', 'foundingDate', 'email', 'address', 'sameAs']) {
    assert.ok(o[key], `${key} が無い`);
  }
  assert.deepEqual(o.sameAs, ['https://larubot.tokyo', 'https://laruhp.com']);
  // sameAs は同一主体の宣言。受託で作ったクライアントのサービスを入れると、
  // 他社のサイトを自社だと検索側へ伝えることになる。
  assert.ok(!(o.sameAs as string[]).some(u => u.includes('flastal')), '受託案件のURLが sameAs に入っている');
  assert.equal((o.address as Record<string, string>).addressLocality, '板橋区');
});

test('地域ページの対応地域が、画面と構造化データで同じものを使う', () => {
  const src = readFileSync(new URL('../app/local/page.tsx', import.meta.url), 'utf8');
  assert.match(src, /const AREAS = AREAS_SERVED;/);
  const withArea = organizationWithAreaLd() as Record<string, unknown>;
  assert.equal((withArea.areaServed as unknown[]).length, AREAS_SERVED.length);
});

test('サイト自体も名乗る', () => {
  const w = websiteLd() as Record<string, unknown>;
  assert.equal(w['@type'], 'WebSite');
  assert.deepEqual(w.publisher, { '@id': ORG_ID });
});

test('料金は画面の文字列から取り出す（書き写さない）', () => {
  assert.equal(priceFrom('¥150,000〜'), 150000);
  assert.equal(priceFrom('月額 ¥30,000〜'), 30000);
  assert.equal(priceFrom('要相談'), null);

  const services = readFileSync(new URL('../app/services/page.tsx', import.meta.url), 'utf8');
  assert.match(services, /serviceOffersLd\(SERVICES\)/, '料金表そのものを渡していない');

  const ld = serviceOffersLd([
    { title: 'A', price: '¥300,000〜', desc: 'x' },
    { title: 'B', price: '要相談', desc: 'y' },
  ]) as Record<string, unknown>;
  const items = (ld.hasOfferCatalog as Record<string, unknown>).itemListElement as Record<string, unknown>[];
  assert.equal(items[0].price, 300000);
  assert.equal('price' in items[1], false, '金額が読めないものに価格を書かない');
});

test('参考価格であることが、構造化データでも分かる', () => {
  const ld = serviceOffersLd([{ title: 'A', price: '¥300,000〜', desc: 'x' }]) as Record<string, unknown>;
  const item = ((ld.hasOfferCatalog as Record<string, unknown>).itemListElement as Record<string, unknown>[])[0];
  const spec = item.priceSpecification as Record<string, unknown>;
  assert.equal(spec.minPrice, 300000);
  assert.equal(spec.valueAddedTaxIncluded, false);
});

test('階層のあるページにパンくずがある', () => {
  for (const p of ['app/works/page.tsx', 'app/works/[slug]/page.tsx', 'app/services/page.tsx']) {
    const src = readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
    assert.match(src, /breadcrumbLd\(/, p);
  }
  const b = breadcrumbLd([{ name: 'ホーム', path: '/' }, { name: '開発実績', path: '/works' }]) as Record<string, unknown>;
  const items = b.itemListElement as Record<string, unknown>[];
  assert.equal(items[1].position, 2);
  assert.equal(items[1].item, 'https://laruvisona.jp/works');
});

test('LARUSEOを独立した製品として並べていない', () => {
  // LARUbotの機能のひとつであって、別プロダクトではない。
  const top = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
  // 注記のコメントは残してよい。製品の並びに入っていないことを見る。
  const meta = top.match(/export const metadata[\s\S]*?\n\};/)![0];
  assert.doesNotMatch(meta.replace(/\/\/.*$/gm, ''), /LARUSEO/);
});
