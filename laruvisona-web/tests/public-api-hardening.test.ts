import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { rateLimit, resetRateLimit } from '../lib/rate-limit.ts';
import { safeReturnUrl, allowedHosts } from '../lib/site-origin.ts';

const root = path.join(import.meta.dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

test('rateLimit は上限を超えたら止める', () => {
  const key = `t-${Math.random()}`;
  for (let i = 0; i < 3; i++) assert.equal(rateLimit(key, 3, 60_000).ok, true, `${i}回目`);
  const over = rateLimit(key, 3, 60_000);
  assert.equal(over.ok, false);
  assert.ok(over.retryAfterSec >= 1);
  resetRateLimit(key);
  assert.equal(rateLimit(key, 3, 60_000).ok, true, 'reset後は通る');
});

test('会員ログインはIP単位とアカウント単位の両方で絞っている', () => {
  const src = read('app/api/hp/members/login/route.ts');
  assert.match(src, /member-login-ip:/);
  assert.match(src, /member-login-acct:/);
  assert.match(src, /status: 429/);
  assert.match(src, /resetRateLimit/, 'ログイン成功でカウントを戻すこと');
});

test('会員登録・パスワード再設定にもレート制限がある', () => {
  assert.match(read('app/api/hp/members/signup/route.ts'), /rateLimit\(`member-signup:/);
  assert.match(read('app/api/hp/members/reset/route.ts'), /rateLimit\(`member-reset-submit:/);
});

test('決済と予約のエンドポイントにもレート制限がある', () => {
  assert.match(read('app/api/shop/checkout/route.ts'), /rateLimit\(`shop-checkout:/);
  assert.match(read('app/api/stripe/buy/route.ts'), /rateLimit\(`stripe-buy:/);
  assert.match(read('app/api/hp/booking/reserve/route.ts'), /rateLimit\(`booking-reserve:/);
});

test('決済の戻り先はクライアントの言い値をそのまま使わない', () => {
  const checkout = read('app/api/shop/checkout/route.ts');
  assert.match(checkout, /safeReturnUrl\(successUrl/);
  assert.match(checkout, /safeReturnUrl\(cancelUrl/);
  assert.equal(/success_url:\s*successUrl\s*\|\|/.test(checkout), false);

  const buy = read('app/api/stripe/buy/route.ts');
  assert.match(buy, /safeReturnUrl\(siteUrl/);
  assert.equal(/const base = \(siteUrl \|\|/.test(buy), false);
});

test('safeReturnUrl は許可外ホストを自サイトに落とす', () => {
  const site = { slug: 'demo', custom_domain: 'example-shop.jp' };
  const evil = safeReturnUrl('https://attacker.example/steal', 'https://example-shop.jp', site);
  assert.equal(evil.includes('attacker.example'), false);

  const good = safeReturnUrl('https://example-shop.jp/thanks', 'https://example-shop.jp', site);
  assert.equal(good, 'https://example-shop.jp/thanks');

  // クエリとフラグメントは落ちる
  const stripped = safeReturnUrl('https://example-shop.jp/t?a=1#x', 'https://example-shop.jp', site);
  assert.equal(stripped, 'https://example-shop.jp/t');

  // javascript: は通さない
  const js = safeReturnUrl('javascript:alert(1)', 'https://example-shop.jp', site);
  assert.equal(js.startsWith('javascript:'), false);
});

test('サイト情報が無い場合（本体サイト）は本体のホストしか許可しない', () => {
  const hosts = allowedHosts({});
  assert.equal(hosts.has('attacker.example'), false);
  const out = safeReturnUrl('https://attacker.example/x', null, {});
  assert.equal(out.includes('attacker.example'), false);
});
