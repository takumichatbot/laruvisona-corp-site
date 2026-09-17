import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { invoiceSubscriptionId, subscriptionPeriodEnd, subscriptionStartedAt } from '../lib/stripe-shape';
import { bareSource } from './helpers/bare-source';

/**
 * Stripe の形が版で変わったのに、古い場所を読み続けていた。
 *
 * lib/stripe.ts は apiVersion を '2026-05-27.dahlia' に固定している。
 * この版で、ふたつの場所が動いた。
 *
 *   Invoice.subscription            → Invoice.parent.subscription_details.subscription
 *   Subscription.current_period_end → Subscription.items.data[].current_period_end
 *
 * どちらも**無くなっただけで、例外は出ない。** undefined が返り、静かに先へ進む。
 *
 * 起きていたこと。
 *   ・invoice.payment_failed で契約IDが取れず break していた。
 *     **お客様のカードが落ちても past_due にならず、サービスも止まらず、
 *     お知らせも届かない。** Stripe が最後に契約を消すまで無料で使われる。
 *     しかも200を返すので、Stripe側からは「全部成功」に見える。
 *   ・contract_ends_at が常に「処理時刻＋6ヶ月」の既定値のまま入る。
 *     ダッシュボードの「最低契約期間: 〜◯月◯日」は、Stripeの実際の契約とは
 *     **無関係な数字**だった。それらしく見えるので誰も疑わない。
 */

const read = (p: string) => bareSource(fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));

test('いまの版の請求書から、契約IDが取れる', () => {
  const invoice = { id: 'in_1', parent: { subscription_details: { subscription: 'sub_new' } } };
  assert.equal(invoiceSubscriptionId(invoice), 'sub_new');
  // 展開された形（オブジェクトで入ってくる）でも取れること
  assert.equal(invoiceSubscriptionId({ parent: { subscription_details: { subscription: { id: 'sub_x' } } } }), 'sub_x');
});

test('古い版の請求書でも、契約IDが取れる', () => {
  // webhook はエンドポイントごとの版で届く。古い形で来ることがある。
  assert.equal(invoiceSubscriptionId({ subscription: 'sub_old' }), 'sub_old');
  assert.equal(invoiceSubscriptionId({ subscription: { id: 'sub_old2' } }), 'sub_old2');
  assert.equal(invoiceSubscriptionId({ subscription_id: 'sub_old3' }), 'sub_old3');
});

test('取れないときは、取れないと分かる形で返す', () => {
  // ここで嘘の値を返すと、関係のない人の契約を止めてしまう。
  for (const bad of [null, undefined, {}, { subscription: '' }, { parent: {} }, 'sub_1', 42]) {
    assert.equal(invoiceSubscriptionId(bad), null, JSON.stringify(bad));
  }
});

test('いまの版の契約から、期間の終わりが取れる', () => {
  const sub = { items: { data: [{ current_period_end: 1_700_000_000 }] } };
  assert.equal(subscriptionPeriodEnd(sub), 1_700_000_000);
  // 明細が複数あるときは、いちばん遅いものを契約の終わりとみなす
  assert.equal(subscriptionPeriodEnd({ items: { data: [
    { current_period_end: 1_700_000_000 },
    { current_period_end: 1_800_000_000 },
  ] } }), 1_800_000_000);
});

test('古い版の契約でも、期間の終わりが取れる', () => {
  assert.equal(subscriptionPeriodEnd({ current_period_end: 1_600_000_000 }), 1_600_000_000);
});

test('分からないときは null。既定値でごまかさない', () => {
  // ここで「いまから6ヶ月後」を返すと、画面に出る日付が実データに見えてしまう。
  for (const bad of [null, {}, { items: { data: [] } }, { current_period_end: 0 }, { items: { data: [{}] } }]) {
    assert.equal(subscriptionPeriodEnd(bad), null, JSON.stringify(bad));
  }
});

test('契約の始まりは start_date を最優先する', () => {
  // 請求期間の始まりは毎月動く。それを最低利用期間の起点にすると
  // **いつまでも明けない。** start_date があれば必ずそちらを使う。
  assert.equal(subscriptionStartedAt({ start_date: 111, items: { data: [{ current_period_start: 999 }] } }), 111);
  assert.equal(subscriptionStartedAt({ items: { data: [{ current_period_start: 999 }] } }), 999);
  assert.equal(subscriptionStartedAt({}), null);
});

test('webhook と定期同期が、その一本を通る', () => {
  const wh = read('app/api/stripe/webhook/route.ts');
  assert.match(wh, /invoiceSubscriptionId\(inv\)/);
  assert.match(wh, /subscriptionPeriodEnd\(sub\)/);
  assert.match(wh, /subscriptionStartedAt\(sub\)/);
  // 古い場所を直に読む所が残っていないこと
  assert.doesNotMatch(wh, /inv\['subscription'\]/, '請求書の古い場所を直に読んでいる');
  assert.doesNotMatch(wh, /sub\.current_period_end/, '契約の古い場所を直に読んでいる');

  const rec = read('lib/subscription-reconcile.ts');
  assert.match(rec, /subscriptionPeriodEnd\(sub\)/);
  assert.doesNotMatch(rec, /iso\(sub\.current_period_end\)/, '古い場所を直に読んでいる');
});

test('契約IDが取れなかったことを、黙って捨てない', () => {
  // 以前は break するだけだった。どこにも記録が残らない。
  const wh = read('app/api/stripe/webhook/route.ts');
  for (const evt of ['payment_succeeded', 'payment_failed']) {
    assert.match(wh, new RegExp(`${evt}: subscription id not found`), `${evt}: 記録に残していない`);
  }
});

test('この版に無い項目を、型で名指ししていない', () => {
  // 型で書くと「あるもの」として読んでしまう。実際そうなっていた。
  const wh = read('app/api/stripe/webhook/route.ts');
  assert.doesNotMatch(wh, /current_period_end: number/, '無い項目を型で名指ししている');
});
