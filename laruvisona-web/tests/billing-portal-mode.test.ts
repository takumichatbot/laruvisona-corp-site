import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { billingPortalMode, minimumTermEndsAt } from '../lib/billing-portal-mode.ts';

test('最低利用期間は契約の始まりから数える', () => {
  assert.equal(minimumTermEndsAt('2026-01-15T00:00:00.000Z')?.toISOString().slice(0, 10), '2026-07-15');
  assert.equal(minimumTermEndsAt(null), null);
  assert.equal(minimumTermEndsAt('こわれた日付'), null);
});

test('最低利用期間の途中だけ、支払方法の変更に絞る', () => {
  const p = { contract_starts_at: '2026-01-15T00:00:00.000Z', subscription_status: 'active' };
  const inside = billingPortalMode(p, new Date('2026-04-01T00:00:00.000Z'));
  assert.equal(inside.paymentMethodOnly, true);
  assert.equal(inside.cancelableFrom?.slice(0, 10), '2026-07-15');
});

test('7ヶ月目からは解約できる。ここが以前は永久に開かなかった', () => {
  const p = { contract_starts_at: '2026-01-15T00:00:00.000Z', subscription_status: 'active' };
  const after = billingPortalMode(p, new Date('2026-08-01T00:00:00.000Z'));
  assert.equal(after.paymentMethodOnly, false);
  assert.equal(after.cancelableFrom, null);
});

test('契約していない人は、いつでも通常のポータル', () => {
  assert.equal(billingPortalMode({ contract_starts_at: null, subscription_status: 'active' }).paymentMethodOnly, false);
  assert.equal(
    billingPortalMode({ contract_starts_at: '2099-01-01T00:00:00.000Z', subscription_status: 'canceled' }).paymentMethodOnly,
    false,
  );
});

test('請求期間の終わりでは判定しない（以前の不具合の再発防止）', () => {
  const route = readFileSync(new URL('../app/api/stripe/portal/route.ts', import.meta.url), 'utf8');
  // 読み出す列と、判定に使う関数の両方を見る（説明のコメントは対象外）。
  const select = route.match(/\.select\('([^']+)'\)/)?.[1] ?? '';
  assert.doesNotMatch(select, /contract_ends_at/);
  assert.match(select, /contract_starts_at/);
  assert.match(route, /billingPortalMode\(profile\)/);
  assert.doesNotMatch(route, /new Date\(profile\.contract_ends_at\)/);
});
