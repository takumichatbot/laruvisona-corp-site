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
  assert.match(src, /claimPublicRate\(supabase, 'member-login-ip'/);
  assert.match(src, /claimPublicRate\(supabase, 'member-login-account'/);
  assert.match(src, /status: 429/);
  assert.match(src, /rate === 'unavailable'|ipRate === 'unavailable'/, '共有制限を読めないとき通さないこと');
});

test('会員登録・パスワード再設定にもレート制限がある', () => {
  assert.match(read('app/api/hp/members/signup/route.ts'), /claimPublicRate\(supabase, 'member-signup'/);
  assert.match(read('app/api/hp/members/reset/route.ts'), /claimPublicRate\(supabase, 'member-reset-submit'/);
});

test('決済と予約のエンドポイントにもレート制限がある', () => {
  assert.match(read('app/api/shop/checkout/route.ts'), /claimPublicRate\(service, 'shop-checkout'/);
  assert.match(read('app/api/stripe/buy/route.ts'), /claimPublicRate\(createServiceClient\(\), 'stripe-buy'/);
  assert.match(read('app/api/hp/booking/reserve/route.ts'), /claimPublicRate\(supabase, 'booking-reserve'/);
  assert.match(read('app/api/hp/scheduling/route.ts'), /claimPublicRate\(db,"schedule-write"/);
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

test('旧予約の決済Webhookは支払いと予約を結び、通知失敗を再試行可能に戻す', () => {
  const webhook = read('app/api/stripe/webhook/route.ts');
  assert.match(webhook, /session\.payment_status !== 'paid'/, '未払いのCheckoutで確定しないこと');
  assert.match(webhook, /\.eq\('site_id', siteId\)\.eq\('stripe_session_id', session\.id\)/,
    '予約をサイトとStripeセッションの両方に結びつけること');
  assert.match(webhook, /\.eq\('status', 'pending'\)\.select\('\*'\)\.maybeSingle\(\)/,
    '並行Webhookのうち1本だけが確定を獲得すること');
  assert.match(webhook, /if \(!notified\)[\s\S]*update\(\{ status: 'pending' \}\)[\s\S]*status: 500/,
    '通知失敗を成功扱いにせず、Stripeの再送で回収できること');
});

test('旧予約金は店舗別Stripeを通る新しい予約管理へ一本化する', () => {
  const availability = read('app/api/hp/booking/availability/route.ts');
  assert.match(availability, /prepay: false/);
  assert.match(availability, /prepayAmount: 0/);
  assert.doesNotMatch(availability, /prepay:\s*!!cfg\.prepayEnabled/);

  const reserve = read('app/api/hp/booking/reserve/route.ts');
  const stoppedAt = reserve.indexOf('旧予約金は受付を停止しました');
  const insertedAt = reserve.indexOf(".from('hp_reservations')\n    .insert");
  assert.ok(stoppedAt >= 0 && insertedAt > stoppedAt, '予約を作る前に旧予約金を止めること');
  assert.match(reserve, /manageUrl: `\/laruHP\/booking\/schedule\?siteId=/);

  const page = read('app/laruHP/booking/page.tsx');
  assert.match(page, /新しい予約管理を開く/);
  assert.match(page, /\/laruHP\/booking\/schedule/);
  assert.doesNotMatch(page, /事前決済（予約金）を有効化/);
});

test('旧購入APIは運営が許可した価格だけを扱い、新規販売を店舗ショップへ分ける', () => {
  const buy = read('app/api/stripe/buy/route.ts');
  assert.match(buy, /STRIPE_PUBLIC_BUY_PRICE_IDS/);
  assert.match(buy, /allowedPrices\.has\(priceId\)/);
  assert.match(buy, /ショップ機能をご利用ください/);
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
