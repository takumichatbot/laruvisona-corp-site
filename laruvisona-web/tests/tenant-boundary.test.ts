// テナント境界と、クライアント入力をそのまま信用していた箇所の回帰テスト。
//
// - 有料会員バイパス: /api/hp/members/subscribe が priceId をボディから受けて
//   Stripe にそのまま渡していた。webhook は kind=member だけを見て有料化するため、
//   会員が安い（あるいは無料の）価格を指定すれば有料コンテンツを解放できた。
// - オープンリダイレクト: subscribe / portal の returnUrl が無検証で
//   Stripe の戻り先に入っていた。
// - 未公開サイトの漏れ: /api/popup が published を見ていなかった。
//
// 外部サービスへは接続しない。

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

process.env.NEXT_PUBLIC_APP_URL = 'https://laruvisona.jp';

const { collectPriceIds, findBlock } = await import('../lib/site-blocks.ts');
const { safeOrigin, safeReturnUrl, allowedHosts } = await import('../lib/site-origin.ts');

const site = { slug: 'acme', custom_domain: 'acme-shop.example' };

// v2（pages 入れ子）と v1（配列）の両方を含む現実的な形
const blocks = {
  pages: [
    {
      id: 'home',
      blocks: [
        { id: 'b1', type: 'hero', data: { heading: 'x' } },
        { id: 'b2', type: 'member-gate', data: { content: '秘密', requirePaid: true, priceId: 'price_member_ok' } },
        { id: 'b3', type: 'stripe-buy', data: { label: 'Tシャツ', priceId: 'price_onetime_shirt' } },
      ],
    },
    {
      id: 'sub',
      blocks: [
        { id: 'b4', type: 'member-gate', data: { content: '別ページ', requirePaid: true, priceId: 'price_member_two' } },
      ],
    },
  ],
};

test('会員ゲートの価格だけを集める（買い切り価格は含めない）', () => {
  const ids = collectPriceIds(blocks, 'member-gate');
  assert.deepEqual([...ids].sort(), ['price_member_ok', 'price_member_two']);
  assert.ok(!ids.has('price_onetime_shirt'), '買い切り価格が月額の許可リストに混ざっている');
});

test('設定にない価格は許可リストに入らない（攻撃者が指定する価格）', () => {
  const ids = collectPriceIds(blocks, 'member-gate');
  for (const bad of ['price_free_trial', 'price_1yen', '', 'PRICE_MEMBER_OK']) {
    assert.equal(ids.has(bad), false, `${bad} を許可してはいけない`);
  }
});

test('ブロック探索は id と type の両方が一致したものだけ返す', () => {
  assert.ok(findBlock(blocks, 'b2', 'member-gate'));
  assert.equal(findBlock(blocks, 'b3', 'member-gate'), null, '型違いを拾っている');
  assert.equal(findBlock(blocks, 'nope', 'member-gate'), null);
});

test('許可ホストは自ドメイン・スラッグのサブドメイン・独自ドメインのみ', () => {
  const hosts = allowedHosts(site);
  for (const h of ['laruvisona.jp', 'www.laruvisona.jp', 'acme.laruvisona.jp', 'acme-shop.example', 'www.acme-shop.example']) {
    assert.ok(hosts.has(h), `${h} は許可されるべき`);
  }
  for (const h of ['attacker.example', 'laruvisona.jp.attacker.example', 'other.laruvisona.jp']) {
    assert.equal(hosts.has(h), false, `${h} を許可してはいけない`);
  }
});

test('Origin は許可外なら自サイトに落とす', () => {
  assert.equal(safeOrigin('https://acme-shop.example', site), 'https://acme-shop.example');
  assert.equal(safeOrigin('https://attacker.example', site), 'https://laruvisona.jp');
  assert.equal(safeOrigin('javascript:alert(1)', site), 'https://laruvisona.jp');
  assert.equal(safeOrigin(null, site), 'https://laruvisona.jp');
});

test('returnUrl は攻撃者ドメインへ飛ばせない', () => {
  const origin = 'https://acme-shop.example';
  assert.equal(safeReturnUrl('https://attacker.example/steal', origin, site), origin);
  assert.equal(safeReturnUrl('//attacker.example', origin, site), origin);
  assert.equal(safeReturnUrl('javascript:alert(1)', origin, site), origin);
  assert.equal(safeReturnUrl('https://laruvisona.jp.attacker.example/x', origin, site), origin);
});

test('returnUrl は許可ホストなら残し、クエリ・フラグメントは落とす', () => {
  const origin = 'https://acme-shop.example';
  assert.equal(safeReturnUrl('https://acme-shop.example/members?token=abc#x', origin, site), 'https://acme-shop.example/members');
  assert.equal(safeReturnUrl('/members/mypage', origin, site), 'https://acme-shop.example/members/mypage');
});

// ── 実装そのものを見る（型では表現できないため文面で固定する） ──────────
const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
const subscribe = read('../app/api/hp/members/subscribe/route.ts');
const portal = read('../app/api/hp/members/portal/route.ts');
const popup = read('../app/api/popup/route.ts');

test('subscribe はサイト設定の価格だけを Stripe に渡す', () => {
  assert.ok(/collectPriceIds\(/.test(subscribe), '価格の許可リストを作っていない');
  assert.ok(/allowedPrices\.has\(/.test(subscribe), '渡された priceId を照合していない');
  assert.ok(/price\.recurring/.test(subscribe), 'recurring 価格かを確認していない');
  assert.ok(/safeReturnUrl\(/.test(subscribe), 'returnUrl を検証していない');
  assert.ok(/\.eq\(\s*'published'\s*,\s*true\s*\)/.test(subscribe), '未公開サイトで購読できてしまう');
});

test('portal は戻り先を検証する', () => {
  assert.ok(/safeReturnUrl\(/.test(portal), 'returnUrl を検証していない');
  assert.ok(!/return_url:\s*\(returnUrl/.test(portal), 'returnUrl を直接 Stripe に渡している');
});

test('popup は公開済みサイトの設定しか返さない', () => {
  const eqPublished = (popup.match(/\.eq\('published',\s*true\)/g) || []).length;
  assert.ok(eqPublished >= 2, `published の確認が足りない（${eqPublished}箇所）`);
});
