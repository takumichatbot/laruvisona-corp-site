import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PLANS, TERMS, MONTHLY, ANNUAL_TOTAL, SECONDARY_CTA } from '../lib/laruhp-facts';
import { PLAN_SEQUENCE_LIMIT, getSequenceLimit, hasFeature } from '../lib/plan-limits';
import { verifyFirstMonthCoupon } from '../lib/price-integrity';

const code = (p: string) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');

/**
 * 公開している文章の「できます」と、実装の対応を固定する。
 * 2026-09-17 の点検で、53件の断定のうち15件が実装と食い違っていた。
 * 文章だけ直しても同じことが起きるので、対応をテストに書いておく。
 */

test('売っているプランが、契約条件の正本にすべて載っている', () => {
  const ids = PLANS.map(p => p.id).sort();
  // MONTHLY は料金ページが使う一覧。売っているのに PLANS に無いプランがあると、
  // 特商法・規約・LPの料金がそのプランについて何も言っていない状態になる。
  const sold = ['hp', 'lite', 'hp-bot', 'hp-bot-seo', 'agency'].sort();
  assert.deepEqual(ids, sold);
  for (const p of PLANS) {
    const key = p.id === 'hp-bot' ? 'hpBot' : p.id === 'hp-bot-seo' ? 'hpBotSeo' : p.id;
    assert.equal(p.monthly, MONTHLY[key as keyof typeof MONTHLY], `${p.id} の月額が MONTHLY と違う`);
  }
});

test('特商法の表記に、売っている全プランと年払いが載っている', () => {
  const src = code('app/laruHP/tokusho/page.tsx');
  assert.match(src, /PLANS\.map/, '1プランだけ直書きすると、増えたプランが法定表記から漏れる');
  assert.match(src, /ANNUAL_TOTAL/, '年払いを売っているのに表記が無い');
  assert.match(src, /年払い/);
});

test('規約に年払いの条件がある', () => {
  const src = code('app/laruHP/terms/page.tsx');
  assert.match(src, /年払い/, '年払い（一括・途中返金なし）を売っているのに規約に書いていない');
});

test('メールシーケンスの本数が、料金表とAPIで一致している', () => {
  // 料金表: hp:− / lite:3件 / hp-bot・hp-bot-seo:5件
  assert.equal(getSequenceLimit('hp'), 0);
  assert.equal(getSequenceLimit('lite'), 3);
  assert.equal(getSequenceLimit('hp-bot'), 5);
  assert.equal(getSequenceLimit('hp-bot-seo'), 5);
  assert.ok(PLAN_SEQUENCE_LIMIT.agency >= 5);
  const api = code('app/api/sequences/route.ts');
  assert.match(api, /getSequenceLimit/, '表に線引きを書くなら、作る側にも置く');
  assert.match(api, /limit_reached/);
});

test('エージェンシーは「全機能込み」で売っているので、全機能が使える', () => {
  for (const feature of ['larubot', 'seo', 'sequences', 'shop', 'publish']) {
    assert.ok(hasFeature('agency', feature), `agency に ${feature} が無い`);
  }
  const builder = code('app/laruHP/builder/page.tsx');
  assert.ok(
    !/canUse = userPlan === 'hp-bot-seo'/.test(builder),
    'プラン判定を直書きすると、agency のように後から足したプランが漏れる',
  );
});

test('「初月無料」は、割引が足りないクーポンを弾く', () => {
  assert.ok(verifyFirstMonthCoupon('agency', { percent_off: 100, duration: 'once' }).ok);
  // 固定額999円オフだと、HP単体は無料になるがエージェンシーは18,801円請求される
  const fixed = { amount_off: 999, currency: 'jpy', duration: 'once' };
  assert.ok(verifyFirstMonthCoupon('hp', fixed).ok);
  assert.ok(!verifyFirstMonthCoupon('agency', fixed).ok);
  assert.ok(!verifyFirstMonthCoupon('hp', { percent_off: 50, duration: 'once' }).ok);
  assert.ok(!verifyFirstMonthCoupon('hp', { percent_off: 100, duration: 'forever' }).ok);
  const checkout = code('app/api/stripe/checkout/route.ts');
  assert.match(checkout, /verifyFirstMonthCoupon/, '売る前にクーポンの中身を見る');
});

test('解約条件を、前提を落として書かない', () => {
  // 「いつでも解約可」だけだと、6ヶ月の拘束が無いように読める
  for (const path of ['app/laruHP/demo/page.tsx', 'app/laruHP/plans/page.tsx', 'app/laruHP/page.tsx']) {
    const src = code(path);
    const loose = /いつでも解約(可|できます)/.exec(src);
    if (loose) {
      const around = src.slice(Math.max(0, loose.index - 200), loose.index + 200);
      assert.match(around, /7ヶ月目|最低利用期間（6ヶ月）の途中では/, `${path}: 「いつでも解約」に前提が無い`);
    }
  }
  assert.equal(TERMS.minimumMonths, 6);
});

test('ページ内リンクの飛び先が実在する', () => {
  const top = code('components/immersive/CompanyExperience.tsx');
  const idsOf = (src: string) => new Set(Array.from(src.matchAll(/id="([a-zA-Z0-9_-]+)"/g)).map(m => m[1]));
  const topIds = idsOf(top);

  const pages = [
    'app/laruHP/page.tsx',
    'app/services/page.tsx',
    'app/works/page.tsx',
    'app/works/[slug]/page.tsx',
  ];
  for (const path of pages) {
    const src = code(path);
    const own = idsOf(src);
    for (const m of src.matchAll(/href="#([a-zA-Z0-9_-]+)"/g)) {
      assert.ok(own.has(m[1]), `${path}: #${m[1]} に対応する id が無い`);
    }
    for (const m of src.matchAll(/href="\/#([a-zA-Z0-9_-]+)"/g)) {
      assert.ok(topIds.has(m[1]), `${path}: トップに id="${m[1]}" が無い`);
    }
  }
  assert.ok(topIds.has(SECONDARY_CTA.href.replace('#', '')) || idsOf(code('app/laruHP/page.tsx')).has(SECONDARY_CTA.href.replace('#', '')),
    `SECONDARY_CTA の飛び先 ${SECONDARY_CTA.href} が存在しない`);
});

test('実績ページの開発体制は、案件ごとのデータから出す', () => {
  const page = code('app/works/[slug]/page.tsx');
  assert.match(page, /work\.structure\.headline/, '全案件に同じ「企画から運用まで」を出すと、企画を担当していない案件で嘘になる');
  assert.doesNotMatch(page, /モバイルアプリの受託開発/, '出していないものを実績の近くで売らない');
});

test('年払いの総額が、月額×10ヶ月ぶんになっている（実質2ヶ月無料）', () => {
  assert.equal(ANNUAL_TOTAL.hp, MONTHLY.hp * 10);
  assert.equal(ANNUAL_TOTAL.agency, MONTHLY.agency * 10);
});

test('記事の金額が、初月無料を計算に入れている', () => {
  const src = code('app/laruHP/articles/articles-data.ts');
  assert.doesNotMatch(src, /5,994円/, '999×6は初月無料を無視した額。実際に払うのは4,995円');
  assert.doesNotMatch(src, /35,964円/, '999×36も同じ。実際は34,965円');
  assert.match(src, /4,995円/);
});

test('月額のサービスを、構造化データで単発の費用として出さない', async () => {
  const { serviceOffersLd } = await import('../lib/organization-ld');
  const ld = serviceOffersLd([
    { title: '保守・運用', price: '月額 ¥30,000〜', desc: '公開して終わりにしません' },
    { title: 'ホームページ制作', price: '¥150,000〜', desc: '作ります' },
  ]) as { hasOfferCatalog: { itemListElement: { priceSpecification?: Record<string, unknown> }[] } };
  const [monthly, oneOff] = ld.hasOfferCatalog.itemListElement;
  assert.equal(monthly.priceSpecification?.['@type'], 'UnitPriceSpecification');
  assert.equal(monthly.priceSpecification?.unitCode, 'MON');
  assert.equal(oneOff.priceSpecification?.['@type'], 'PriceSpecification');
});

test('税別だと構造化データで言うなら、画面にも書く', () => {
  const page = code('app/services/page.tsx');
  assert.match(page, /税別/, '画面が言っていないことを構造化データだけが主張している状態にしない');
});

test('契約条件を変えたら、法定表記の日付も変わっている', () => {
  // 2026-09-17 に特商法・規約の中身を直した。最終更新日が古いままだと、
  // 「いつの条件に同意したのか」が読み手から分からない。
  assert.match(code('app/laruHP/tokusho/page.tsx'), /最終更新日: 2026年9月17日/);
  assert.match(code('app/laruHP/terms/page.tsx'), /最終更新日: 2026年9月17日/);
});

test('実装で差がついていないサポートを、差があるように書かない', () => {
  const facts = code('lib/laruhp-facts.ts');
  // プランごとにサポート内容を分ける仕組みはコードに無い（窓口は1つ）。
  assert.doesNotMatch(facts, /チャットサポート/, '実装に無いサポート区分を売らない');
  assert.doesNotMatch(facts, /優先サポート/);
  const plans = code('app/laruHP/plans/page.tsx');
  assert.match(plans, /サポート（メール）/);
});
