import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { touchFrom, carryParams, signupMetadata } from '../lib/acquisition.ts';

const read = (p: string) => readFileSync(p, 'utf8');

test('流入: utm があればそれを使う', () => {
  const t = touchFrom('?utm_source=x&utm_medium=social&utm_campaign=c1', '', '/articles/a');
  assert.deepEqual(t, { source: 'x', medium: 'social', campaign: 'c1', landing: '/articles/a' });
});

test('流入: 検索エンジンは organic、その他は referral', () => {
  assert.deepEqual(touchFrom('', 'https://www.google.co.jp/', '/'), { source: 'google', medium: 'organic', landing: '/' });
  assert.deepEqual(touchFrom('', 'https://search.yahoo.co.jp/search?p=a', '/'), { source: 'yahoo', medium: 'organic', landing: '/' });
  assert.deepEqual(touchFrom('', 'https://example.org/post', '/beauty'), { source: 'example.org', medium: 'referral', landing: '/beauty' });
});

test('流入: 自社・Googleログイン・Gmail・Stripe・参照元なしは流入にしない（上書きしない）', () => {
  for (const ref of ['', 'https://laruhp.com/', 'https://laruvisona.jp/laruHP', 'https://accounts.google.com/o/oauth2',
    'https://accounts.google.co.jp/', 'https://mail.google.com/mail/u/0', 'https://checkout.stripe.com/c/pay', 'https://dashboard.stripe.com/']) {
    assert.equal(touchFrom('', ref, '/'), null, ref);
  }
});

test('流入: laruhp.com から運ばれた lv_* を受け取り、最初のページも保つ', () => {
  const t = touchFrom('?lv_src=google&lv_med=organic&lv_lp=%2Farticles%2Fx', 'https://laruhp.com/', '/laruHP/studio');
  assert.deepEqual(t, { source: 'google', medium: 'organic', landing: '/articles/x' });
  assert.deepEqual(carryParams(t), { lv_src: 'google', lv_med: 'organic', lv_lp: '/articles/x' });
});

test('登録時: 流入を覚えていなければ何も書かない（直接と推測しない）', () => {
  assert.deepEqual(signupMetadata(null), {});
  assert.deepEqual(signupMetadata({ source: 'google', medium: 'organic' }), { acq_source: 'google', acq_medium: 'organic' });
});

test('GA4: 両ドメインを linker でつなぐ', () => {
  assert.match(read('components/GoogleAnalytics.tsx'), /linker: \{ domains: \['laruhp\.com', 'laruvisona\.jp'\] \}/);
  assert.match(read('app/layout.tsx'), /<FunnelTracking \/>/);
});

test('begin_checkout: Stripe へ移る直前だけ（別ドメインへ渡す前・ログイン前に送らない）', () => {
  const plans = read('app/laruHP/plans/page.tsx');
  const start = plans.slice(plans.indexOf('async function startCheckout'));
  const body = start.slice(0, start.indexOf('\n}\n'));
  assert.ok(body.indexOf('trackBeginCheckout(') > body.indexOf('if (data.url)'), 'Stripe URL を得る前に送っている');
  assert.ok(!/track\('begin_checkout'/.test(plans));
  // 決済を始める全ての画面で、Stripe へ移る行に計測が付いている
  for (const p of ['app/laruHP/dashboard/DashboardClient.tsx', 'app/laruHP/builder/page.tsx']) {
    const s = read(p);
    // 決済APIを呼ぶ箇所の数 = Stripe へ移る箇所の数（契約管理ポータルへの移動は別物なので数えない）
    const redirects = (s.match(/fetch\('\/api\/stripe\/checkout'/g) || []).length;
    const tracked = (s.match(/trackBeginCheckout\([^)]*\); window\.location\.href = (d|data|checkoutData)\.url/g) || []).length;
    assert.equal(tracked, redirects, `${p}: 計測の無い決済リダイレクトがある`);
  }
});

test('公開: 3つの画面すべてで publish_attempt / publish を送る', () => {
  for (const p of ['app/laruHP/studio/page.tsx', 'app/laruHP/builder/page.tsx', 'app/laruHP/dashboard/DashboardClient.tsx']) {
    const s = read(p);
    for (const o of ['plan_required', 'published', 'error']) assert.match(s, new RegExp(`trackPublishAttempt\\('${o}'\\)`), `${p}: ${o}`);
    assert.match(s, /trackPublish\(\)/, p);
    assert.match(s, /trackPurchaseComplete\(\)/, p);
  }
});

test('イベントに個人情報を載せない', () => {
  for (const p of ['lib/funnel.ts', 'components/FunnelTracking.tsx']) {
    const s = read(p);
    assert.ok(!/track(Once)?\([^)]*(email|name|phone|tel|address)/i.test(s), `${p}: 個人情報らしき値を送っている`);
  }
});

test('使えない決済を、使えるように書いていない', () => {
  for (const p of ['app/laruHP/[industry]/page.tsx', 'app/laruHP/articles/articles-data.ts', 'lib/laruhp-industry-detail.ts']) {
    const s = read(p);
    assert.ok(!/ショップとStripe決済|Stripe決済を組み合わせられます/.test(s), p);
  }
});
