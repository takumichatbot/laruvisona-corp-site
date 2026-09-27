import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MONTHLY, ANNUAL, ANNUAL_TOTAL, PLANS, FAQ, TERMS } from '../lib/laruhp-facts.ts';
import { SHOWN_AMOUNT, verifyPrice, verifyFirstMonthCoupon } from '../lib/price-integrity.ts';
import { FREE_SITE_LIMIT } from '../lib/site-creation-access.ts';

/* 2026-09-27 HP単体を月額1,980円（年払い19,800円）へ。他プランは据え置き。 */

test('HP単体: 月1,980円・年19,800円（月払い10ヶ月分＝実質2ヶ月無料）', () => {
  assert.equal(MONTHLY.hp, 1980);
  assert.equal(ANNUAL_TOTAL.hp, 19800);
  assert.equal(ANNUAL_TOTAL.hp, MONTHLY.hp * 10);
  assert.equal(ANNUAL.hp, ANNUAL_TOTAL.hp / 12);
  assert.equal(PLANS[0].id, 'hp');
  assert.equal(PLANS[0].monthly, MONTHLY.hp);
  assert.equal(PLANS[0].annualPerMonth, ANNUAL.hp);
});

test('他プランは変えていない', () => {
  assert.deepEqual({ ...MONTHLY, hp: 0 }, { hp: 0, lite: 2980, hpBot: 4980, hpBotSeo: 9800, agency: 19800 });
  assert.deepEqual({ ...ANNUAL_TOTAL, hp: 0 }, { hp: 0, lite: 29800, hpBot: 49800, hpBotSeo: 98000, agency: 198000 });
});

test('決済直前の照合: 新しい額の価格だけを通し、古い999円・9,990円の価格は通さない', () => {
  assert.deepEqual(SHOWN_AMOUNT.hp, { monthly: 1980, annual: 19800 });
  const p = (amt: number, interval: string) => ({ unit_amount: amt, currency: 'jpy', recurring: { interval } });
  assert.equal(verifyPrice('hp', 'monthly', p(1980, 'month')).ok, true);
  assert.equal(verifyPrice('hp', 'annual', p(19800, 'year')).ok, true);
  assert.equal(verifyPrice('hp', 'monthly', p(999, 'month')).ok, false);
  assert.equal(verifyPrice('hp', 'annual', p(9990, 'year')).ok, false);
  assert.equal(verifyPrice('hp', 'monthly', p(19800, 'year')).ok, false, '月払いと年払いの取り違え');
  assert.equal(verifyPrice('lite', 'monthly', p(2980, 'month')).ok, true);
  // 初月無料: 100%オフなら新価格でも無料。999円の固定額クーポンでは足りない
  assert.equal(verifyFirstMonthCoupon('hp', { percent_off: 100, duration: 'once' }).ok, true);
  assert.equal(verifyFirstMonthCoupon('hp', { amount_off: 999, currency: 'jpy', duration: 'once' }).ok, false);
});

test('案内文に古い額が残っていない・無料範囲が実装と一致', () => {
  const faq = JSON.stringify(FAQ);
  assert.ok(!faq.includes('999円') && !faq.includes('833円'), faq);
  assert.match(faq, /1,980円/);
  assert.match(faq, /年額19,800円/);
  assert.equal(FREE_SITE_LIMIT, 1);
  assert.match(TERMS.freeScope, /無料登録で1サイトまで保存/);
  assert.match(TERMS.freeScope, /公開するときにご契約/);
  for (const p of ['app/laruHP/page.tsx', 'app/laruHP/[industry]/page.tsx', 'app/laruHP/articles/[slug]/page.tsx']) {
    const s = readFileSync(p, 'utf8');
    assert.ok(!s.includes('保存・公開にはご契約が必要'), p);
    assert.match(s, /TERMS\.freeScope/, p);
  }
});
