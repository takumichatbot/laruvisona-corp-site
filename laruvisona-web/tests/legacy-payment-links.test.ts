import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseLegacyPaymentLinks, removeLegacyPaymentLink } from '../lib/legacy-payment-links.ts';

const route = readFileSync(new URL('../app/api/stripe/payment-link/route.ts', import.meta.url), 'utf8');
const page = readFileSync(new URL('../app/laruHP/payments/page.tsx', import.meta.url), 'utf8');

const valid = {
  id: 'plink_1AbCdEf',
  url: 'https://buy.stripe.com/test_123',
  amount: 3300,
  description: '相談料',
  buttonText: '支払う',
  currency: 'jpy',
  createdAt: '2026-09-14T00:00:00.000Z',
};

test('旧リンクはStripeの安全なURLと既知の形だけを画面へ返す', () => {
  const links = parseLegacyPaymentLinks({
    untouched: true,
    payment_links: [
      valid,
      { ...valid, id: 'other_1' },
      { ...valid, id: 'plink_bad', url: 'javascript:alert(1)' },
      { ...valid, id: 'plink_evil', url: 'https://example.com/pay' },
      { ...valid, id: 'plink_big', amount: Number.MAX_SAFE_INTEGER },
      null,
    ],
  });
  assert.deepEqual(links, [valid]);
});

test('旧リンクの削除は他のサイト設定と他の有効なリンクを保つ', () => {
  const second = { ...valid, id: 'plink_Second', url: 'https://buy.stripe.com/test_456' };
  assert.deepEqual(removeLegacyPaymentLink({ title: 'keep', payment_links: [valid, second] }, valid.id), {
    title: 'keep',
    payment_links: [second],
  });
});

test('新しいプラットフォーム口座の決済リンクは作らずショップへ案内する', () => {
  const post = route.slice(route.indexOf('export async function POST'), route.indexOf('export async function GET'));
  assert.match(post, /legacy_payment_links_retired/);
  assert.match(post, /status: 410/);
  assert.doesNotMatch(post, /products\.create|prices\.create|paymentLinks\.create/);
  assert.match(page, /売上をご自身のStripe口座へ直接入金/);
  assert.match(page, /href="\/laruHP\/shop"/);
});

test('旧リンクはStripe側の停止成功後にだけローカル一覧から外す', () => {
  const remove = route.slice(route.indexOf('export async function DELETE'));
  assert.ok(remove.indexOf('stripe.paymentLinks.update') < remove.indexOf('removeLegacyPaymentLink'));
  assert.match(remove, /Stripe側でリンクを停止できませんでした/);
  assert.match(remove, /\.eq\('updated_at', site\.updated_at\)\.select\('id'\)/);
  assert.match(remove, /saved\.error \|\| saved\.data\?\.length !== 1/);
  assert.match(page, /if \(!response\.ok\).*setMessage/);
});
