import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verifyPrice, SHOWN_AMOUNT } from '../lib/price-integrity.ts';
import { MONTHLY, ANNUAL_TOTAL } from '../lib/laruhp-facts.ts';

const jpy = (amount: number, interval: string) =>
  ({ unit_amount: amount, currency: 'jpy', recurring: { interval } });

test('額・通貨・請求間隔がそろって初めて通す', () => {
  assert.equal(verifyPrice('hp', 'monthly', jpy(999, 'month')).ok, true);
  assert.equal(verifyPrice('hp', 'monthly', jpy(1000, 'month')).ok, false);
  assert.equal(verifyPrice('hp', 'monthly', { unit_amount: 999, currency: 'usd', recurring: { interval: 'month' } }).ok, false);
  assert.equal(verifyPrice('hp', 'monthly', jpy(999, 'year')).ok, false);
});

test('本番で見つかった食い違い（年払い 9,990 と 9,999）を止める', () => {
  assert.equal(verifyPrice('hp', 'annual', jpy(9990, 'year')).ok, true);
  const bad = verifyPrice('hp', 'annual', jpy(9999, 'year'));
  assert.equal(bad.ok, false);
  if (bad.ok) return;
  assert.match(bad.reason, /9990/);
  assert.match(bad.reason, /9999/);
});

test('安いほうへの食い違いも止める（表示と違う額であることは同じ）', () => {
  assert.equal(verifyPrice('hp', 'monthly', jpy(1, 'month')).ok, false);
});

test('金額が取れない価格を通さない', () => {
  assert.equal(verifyPrice('hp', 'monthly', { unit_amount: null, currency: 'jpy', recurring: { interval: 'month' } }).ok, false);
});

test('知らないプランは照合せず通す（既存の経路を壊さない）', () => {
  const v = verifyPrice('unknown-plan', 'monthly', jpy(1, 'month'));
  assert.equal(v.ok, true);
});

test('照合する額は、画面が使う定数そのものを見る', () => {
  assert.equal(SHOWN_AMOUNT.hp.monthly, MONTHLY.hp);
  assert.equal(SHOWN_AMOUNT.agency.annual, ANNUAL_TOTAL.agency);
  const source = readFileSync(new URL('../lib/price-integrity.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /monthly: 999,/);
});

test('決済を作る経路は、両方ともこの確認を通る', () => {
  for (const path of ['../app/api/stripe/checkout/route.ts', '../app/api/stripe/upgrade/route.ts']) {
    const route = readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.match(route, /verifyPrice\(/, path);
    // 確認より前に session や subscription を作っていない
    const guard = route.indexOf('verifyPrice(');
    const create = route.search(/stripe\.(checkout\.sessions|subscriptions)\.(create|update)\(/);
    assert.ok(guard >= 0 && create > guard, `${path}: 確認が作成より後になっている`);
  }
});
