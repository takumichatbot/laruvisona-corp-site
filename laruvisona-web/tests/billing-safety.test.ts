import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { billingAppOrigin } from '../lib/billing-url.ts';

const checkout = readFileSync(new URL('../app/api/stripe/checkout/route.ts', import.meta.url), 'utf8');
const upgrade = readFileSync(new URL('../app/api/stripe/upgrade/route.ts', import.meta.url), 'utf8');
const portal = readFileSync(new URL('../app/api/stripe/portal/route.ts', import.meta.url), 'utf8');
const deletion = readFileSync(new URL('../app/api/account/delete/route.ts', import.meta.url), 'utf8');
const adminUser = readFileSync(new URL('../app/api/admin/users/[id]/route.ts', import.meta.url), 'utf8');

test('Stripeの戻り先はリクエストOriginではなく固定したアプリoriginを使う', () => {
  const before = process.env.NEXT_PUBLIC_APP_URL;
  process.env.NEXT_PUBLIC_APP_URL = 'javascript:alert(1)';
  assert.equal(billingAppOrigin(), 'https://laruvisona.jp');
  if (before === undefined) delete process.env.NEXT_PUBLIC_APP_URL; else process.env.NEXT_PUBLIC_APP_URL = before;
  assert.match(checkout, /const origin = billingAppOrigin\(\)/);
  assert.match(portal, /billingAppOrigin\(\)/);
  assert.doesNotMatch(checkout + portal, /headers\.get\('origin'\)/);
});

test('既存契約を読めないとき新しいCheckoutへ進まない', () => {
  assert.match(checkout, /二重請求になり得る/);
  assert.match(checkout, /現在の契約を確認できませんでした/);
  assert.doesNotMatch(checkout, /falling back to new checkout/);
  assert.match(checkout, /stripe\.subscriptions\.list\(/);
  assert.match(checkout, /live\.id !== profile\?\.stripe_subscription_id/);
  assert.match(checkout, /idempotencyKey: `laruhp-checkout-/);
});

test('Stripe変更後のプロフィール更新と新規顧客紐付けは更新1件を確認する', () => {
  assert.match(checkout, /saved\.data\?\.length !== 1/);
  assert.match(checkout, /linked\.data\?\.length !== 1/);
  assert.match(checkout, /idempotencyKey: `laruhp-customer-/);
  assert.match(upgrade, /saved\.data\?\.length !== 1/);
});

test('有効なStripe契約を残したままアカウントを削除できない', () => {
  assert.match(deletion, /stripe\.subscriptions\.list/);
  assert.match(deletion, /active_subscription/);
  assert.ok(deletion.indexOf('stripe.subscriptions.retrieve') < deletion.indexOf('deleteUser'));
  assert.doesNotMatch(deletion, /from\('profiles'\)\.delete/);
  assert.match(deletion, /deleted\.error/);
});

test('Checkoutへ渡すサイトは本人所有を必須にする', () => {
  assert.match(checkout, /UUID\.test\(siteId\)/);
  assert.match(checkout, /\.eq\('id', siteId\)\.eq\('user_id', user\.id\)/);
  assert.match(checkout, /site_id: ownedSiteId/);
  assert.match(checkout, /siteId: ownedSiteId \|\| undefined/);
});

test('最低契約期間中も解約を開放せず支払方法だけ更新できる', () => {
  assert.match(portal, /payment_method_update/);
  assert.match(portal, /paymentMethodOnly \? 'payment_method' : 'manage'/);
  assert.doesNotMatch(portal, /error: 'minimum_contract'/);
});

test('管理者操作もStripe失敗時にDBだけプラン変更・解約済みにしない', () => {
  const planStart = adminUser.indexOf('// プラン変更');
  const cancelStart = adminUser.indexOf('// 強制解約');
  const regularStart = adminUser.indexOf('// 通常の更新');
  const planSection = adminUser.slice(planStart, cancelStart);
  const cancelSection = adminUser.slice(cancelStart, regularStart);

  assert.match(planSection, /Stripeのプラン変更を確定できませんでした/);
  assert.ok(planSection.indexOf('stripe.subscriptions.update') < planSection.indexOf(".update({ plan: body.plan })"));
  assert.match(planSection, /\.eq\('stripe_subscription_id', subscriptionId\)[\s\S]*?\.select\('id'\)/);
  assert.match(planSection, /saved\.error \|\| saved\.data\?\.length !== 1/);

  assert.match(cancelSection, /Stripeの解約を確定できませんでした/);
  assert.ok(cancelSection.indexOf('stripe.subscriptions.cancel') < cancelSection.indexOf("subscription_status: 'canceled'"));
  assert.match(cancelSection, /\.eq\('stripe_subscription_id', subscriptionId\)\.select\('id'\)/);
  assert.match(cancelSection, /canceled\.error \|\| canceled\.data\?\.length !== 1/);
});
