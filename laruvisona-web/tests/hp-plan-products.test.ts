import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HP_PLAN_PRODUCTS, hpProduct, isBotPlan, isSeoPlan, planChangeNotes, keepServerOwnedSettings, HP_SEO_ARTICLES_PER_MONTH } from '../lib/laru-entitlement.ts';
import { isSeoPlan as seoFromLarubot } from '../lib/larubot-seo.ts';
import { hasFeature } from '../lib/plan-limits.ts';
import { PLAN_FAQ } from '../lib/laruhp-facts.ts';

/* 2026-09-27 プランの意味を1か所（HP_PLAN_PRODUCTS）に寄せ、各所が食い違わないことを結果で見る。 */

const ID = '3f2b8c1e-8d4a-4c1b-9a77-0c1d2e3f4a5b';
const OTHER = '11111111-2222-4333-8444-555555555555';

test('プランの中身（お客様向けの名前・Bot・SEO）', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(HP_PLAN_PRODUCTS).map(([k, v]) => [k, [v.bot, v.seo]])), {
    hp: [null, false],
    lite: ['LARUbot Lite', false],
    'hp-bot': ['LARUbot Standard', false],
    'hp-bot-seo': ['LARUbot Standard', true],
    agency: ['LARUbot Lite', true],
  });
  assert.equal(HP_SEO_ARTICLES_PER_MONTH, 5);
  assert.ok(!JSON.stringify(HP_PLAN_PRODUCTS).toLowerCase().includes('starter'), '内部名がお客様向けの名前に出ている');
});

test('表示・出し分け・機能制限・LARUbot登録で、プランの意味が同じ', () => {
  for (const plan of Object.keys(HP_PLAN_PRODUCTS)) {
    assert.equal(isBotPlan(plan), hasFeature(plan, 'larubot'), `${plan}: Botの有無が plan-limits と違う`);
    assert.equal(isSeoPlan(plan), hasFeature(plan, 'seo'), `${plan}: SEOの有無が plan-limits と違う`);
    assert.equal(seoFromLarubot(plan), isSeoPlan(plan), `${plan}: LARUbot登録側と違う`);
  }
  assert.equal(hpProduct('starter'), null, 'LARUbot の内部名をHPのプランとして扱っている');
  const faq = JSON.stringify(PLAN_FAQ);
  assert.equal(PLAN_FAQ.length, 5);
  assert.match(readFileSync('app/laruHP/faq/page.tsx', 'utf8'), /PLAN_FAQ\.map/, '/faq に出していない');
  assert.match(faq, new RegExp(`月${HP_SEO_ARTICLES_PER_MONTH}本まで`));
});

test('プラン変更の確認文: 上げると付くもの、下げると外れるもの。裏側まで止まるとは言わない', () => {
  const up = planChangeNotes('hp', 'hp-bot-seo').join('\n');
  assert.match(up, /現在: HP単体 → 変更後: HP \+ Bot \+ SEO/);
  assert.match(up, /LARUbot Standard）が公開サイトへ自動で設置/);
  assert.match(up, /月5本まで/);
  const down = planChangeNotes('hp-bot', 'hp').join('\n');
  assert.match(down, /公開サイトのAIチャットは表示されなくなります。設定データは保持されます。/);
  const seoDown = planChangeNotes('hp-bot-seo', 'hp-bot').join('\n');
  assert.match(seoDown, /LARU SEO の新しい記事生成とサイト上の記事表示は対象外になります。既存データは保持されます。/);
  assert.doesNotMatch(seoDown, /AIチャット/, 'Botは変わらないのに書いている');
  for (const text of [up, down, seoDown]) {
    assert.doesNotMatch(text, /完全に停止|すべて削除|Starter|starter/);
    assert.match(text, /サイトは作り直しません/);
  }
  assert.match(planChangeNotes('lite', 'hp-bot').join('\n'), /LARUbot Standard）が公開サイトへ自動で設置/);
});

test('連携IDは保存側で守る: 他人のIDへ差し替え・削除・新規作成時の持ち込みを受け付けない', () => {
  const saved = { larubotPublicId: ID, laruseoPublicId: ID, larubotRegisteredPlan: 'lite', larubot: true };
  const sent = { larubotPublicId: OTHER, laruseoPublicId: OTHER, larubot: false, gaTrackingId: 'G-1' };
  const out = keepServerOwnedSettings(saved, sent);
  assert.equal(out.larubotPublicId, ID);
  assert.equal(out.laruseoPublicId, ID);
  assert.equal(out.larubotRegisteredPlan, 'lite');
  assert.equal(out.larubot, false, '持ち主が自分で切るのは自由');
  assert.equal(out.gaTrackingId, 'G-1');
  assert.deepEqual(keepServerOwnedSettings(saved, { gaTrackingId: 'x' }).larubotPublicId, ID, '送らなかったら消える');
  const created = keepServerOwnedSettings(null, sent);
  assert.ok(!('larubotPublicId' in created) && !('laruseoPublicId' in created), '作成時に持ち込める');
});

test('契約中の人のプラン変更は、確認のあとだけ（料金ページ・ダッシュボード）', () => {
  const checkout = readFileSync('app/api/stripe/checkout/route.ts', 'utf8');
  const confirmAt = checkout.indexOf('if (input.confirmed !== true)');
  assert.ok(confirmAt > 0 && confirmAt < checkout.indexOf("claimPublicRate(createServiceClient(), 'plan-billing'"), '確認待ちで回数制限を使っている');
  assert.ok(confirmAt < checkout.indexOf('stripe.subscriptions.update('), '確認前に契約を変えている');
  assert.match(checkout, /needsConfirm: true,\s*notes: planChangeNotes\(/);
  const upgrade = readFileSync('app/api/stripe/upgrade/route.ts', 'utf8');
  assert.ok(upgrade.indexOf('if (body.confirmed !== true)') < upgrade.indexOf('stripe.subscriptions.update('));
  assert.match(readFileSync('app/laruHP/plans/page.tsx', 'utf8'), /if \(res\.status === 409\)/);
  assert.match(readFileSync('app/laruHP/dashboard/DashboardClient.tsx', 'utf8'), /window\.confirm\(notes\.join/);
});

test('エージェンシーで作るクライアントのBotは、契約に含まれる Lite + SEO だけ', () => {
  const setup = readFileSync('app/api/larubot/setup/route.ts', 'utf8');
  assert.match(setup, /if \(!isAdmin && plan !== 'lite'\)/);
  assert.match(setup, /const registerPlan = isAdmin \? plan : 'agency';/);
  assert.match(setup, /plan: registerPlan,/);
  const page = readFileSync('app/laruHP/agency/page.tsx', 'utf8');
  assert.doesNotMatch(page, /label: 'Starter'|label: 'Pro'|label: 'LARU Cloud'/);
});

test('ダッシュボード: 内部名を出さず、通常版は「見る・相談する」まで（購入を煽らない）', () => {
  const s = readFileSync('app/laruHP/dashboard/DashboardClient.tsx', 'utf8');
  assert.doesNotMatch(s, />[^<{]*Starter[^<{]*</);
  assert.doesNotMatch(s, /通常版を購入|通常版を契約/);
  assert.match(s, /LARUbot通常版の機能を見る/);
  assert.match(s, /AIチャットを追加する/);
  assert.match(s, /SEOも追加する/);
});
