import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { advisePlan, firstYearTotal, type PlanNeeds } from '../lib/plan-advice';
import { MONTHLY, ANNUAL_TOTAL, TERMS } from '../lib/laruhp-facts';

const code = (p: string) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');

const base: PlanNeeds = {
  multiClient: false,
  blog: false,
  multilingual: false,
  chat: false,
  twoOrMoreSites: false,
  billing: 'monthly',
  domain: 'none',
};

/**
 * 見積りの答えは、料金表と一言一句合っていないと意味がない。
 * 画面で確かめるのではなく、ここで固定する。
 */

test('やりたいことから、プランが決まる', () => {
  assert.equal(advisePlan(base).planId, 'hp');
  assert.equal(advisePlan({ ...base, chat: true }).planId, 'lite');
  assert.equal(advisePlan({ ...base, chat: true, twoOrMoreSites: true }).planId, 'hp-bot');
  assert.equal(advisePlan({ ...base, twoOrMoreSites: true }).planId, 'hp-bot');
  assert.equal(advisePlan({ ...base, blog: true }).planId, 'hp-bot-seo');
  assert.equal(advisePlan({ ...base, multilingual: true }).planId, 'hp-bot-seo');
  // 制作会社は、ほかに何を選んでいてもエージェンシー
  assert.equal(advisePlan({ ...base, multiClient: true }).planId, 'agency');
  assert.equal(advisePlan({ ...base, multiClient: true, blog: true, chat: true }).planId, 'agency');
});

test('チャットだけなら、いちばん安く付くプランを勧める', () => {
  // HP+Bot（4,980円）にもチャットは付くが、Lite（2,980円）のほうが安い。
  // 高いほうを既定で勧めない。
  const advice = advisePlan({ ...base, chat: true });
  assert.equal(advice.monthly, MONTHLY.lite);
  assert.ok(advice.monthly < MONTHLY.hpBot);
  assert.ok(advice.alsoConsider, '上位に上がる条件を示すこと');
});

test('1年目の合計が、初月無料を織り込んでいる', () => {
  // 月払いは1ヶ月目が0円なので、1年で払うのは11ヶ月分。
  assert.equal(firstYearTotal('hp', 'monthly'), MONTHLY.hp * 11);
  assert.equal(firstYearTotal('hp-bot-seo', 'monthly'), MONTHLY.hpBotSeo * 11);
  // 年払いは10ヶ月分の一括で、初月無料の対象外。
  assert.equal(firstYearTotal('hp', 'annual'), ANNUAL_TOTAL.hp);
  assert.ok(firstYearTotal('hp', 'annual') < firstYearTotal('hp', 'monthly'));
});

test('最低利用期間で必ず発生する額を、先に出す', () => {
  const advice = advisePlan({ ...base, billing: 'monthly' });
  // 初月0円 + 5ヶ月分
  const floor = MONTHLY.hp * (TERMS.minimumMonths - 1);
  assert.ok(advice.cautions.some(line => line.includes(floor.toLocaleString('ja-JP'))),
    `最低でもかかる額（${floor}円）が注意書きに無い`);
  assert.ok(advice.cautions.some(line => line.includes('解約')));
});

test('年払いのときは、返金が無いことを必ず出す', () => {
  const advice = advisePlan({ ...base, billing: 'annual' });
  assert.ok(advice.cautions.some(line => line.includes('返金')));
  assert.ok(advice.cautions.some(line => line.includes('初月無料')));
  // 年払いに「最低6ヶ月」の注意は出さない（条件が違う）
  assert.ok(!advice.cautions.some(line => line.includes('最低でも')));
});

test('独自ドメインの費用を、合計に混ぜない', () => {
  const advice = advisePlan({ ...base, domain: 'new' });
  // 登録事業者ごとに違うので、こちらの合計には入れられない
  assert.equal(advice.firstYearTotal, MONTHLY.hp * 11);
  assert.ok(advice.cautions.some(line => line.includes('独自ドメイン')));
  const src = code('lib/plan-advice.ts');
  // 適当なドメイン費を仮定していないこと
  assert.doesNotMatch(src, /domainCost|DOMAIN_PRICE|1500|3000円/);
});

test('見積りの金額を、画面側に書き写していない', () => {
  const page = code('app/laruHP/simulator/simulator-client.tsx');
  assert.match(page, /advisePlan/);
  // 画面に条件分岐があると、テストで固定できないものが増える
  assert.doesNotMatch(page, /'hp-bot-seo'|'agency'/);
  for (const literal of ['999', '2,980', '19,800']) {
    assert.ok(!page.includes(literal), `画面に金額を書いている: ${literal}`);
  }
});

test('見積りの結論から、申し込みと見本の両方へ行ける', () => {
  const page = code('app/laruHP/simulator/simulator-client.tsx');
  assert.match(page, /LARUHP_APP_ORIGIN/, 'laruhp.com では /laruHP/... は404になる');
  assert.match(page, /ref=sim/, 'どこから来た申し込みかを数えられること');
  assert.match(page, /laruhp\.com\/demo/);
});

test('料金ページの入口が、案内サイト側で行き止まりにならない', () => {
  // /plans は laruhp.com でも配信している。相対の /laruHP/... は404になる。
  const plans = code('app/laruHP/plans/page.tsx');
  assert.doesNotMatch(plans, /href="\/laruHP\//, '相対の /laruHP/... が残っている');
  assert.match(plans, /laruhp\.com\/simulator/, '迷った人の行き先が無い');
});
