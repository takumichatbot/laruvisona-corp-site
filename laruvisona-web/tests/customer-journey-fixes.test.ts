import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyAbWinner } from '../lib/published-html';

/**
 * 2026-09-19 の導線確認で見つかった「画面だけ成功して、実処理が違う」もの。
 */

const read = (p: string) => readFileSync(p, 'utf8');

/* ③ SEO設定画面のOGP画像が使われていなかった */
test('OGP画像は、ビルダー側が空ならSEO設定画面の値を使う', () => {
  const s = read('app/hp/[slug]/page.tsx');
  assert.match(s, /const bizOg = settings\.businessInfo\?\.ogImage;/);
  assert.match(s, /const ogImage = seo\.ogImage \|\| \(typeof bizOg === 'string' && \/\^https\?:\\\/\\\/\/\.test\(bizOg\) \? bizOg : ''\);/,
    'SEO設定画面の値を受け皿にしていない、または絶対URLに限定していない');
  assert.match(s, /images: \[\{ url: ogImage,/, 'og:image が新しい値を使っていない');
  assert.match(s, /images: \[ogImage\]/, 'twitter:image が新しい値を使っていない');
  assert.ok(!/seo\.ogImage \?/.test(s), '古い分岐が残っている');
});

/* ⑤ Lite の価格表記 */
test('Lite の価格が、顧客向けメールと旧管理画面で ¥2,980 になっている', () => {
  assert.match(read('app/api/admin/users/[id]/route.ts'), /lite: 'HP \+ LARUbot Lite \(¥2,980\/月\)'/);
  assert.match(read('app/admin/page.tsx'), /lite: 2980,/);
  // 正（lib/laruhp-facts.ts）と一致
  assert.match(read('lib/laruhp-facts.ts'), /lite: 2980,/);
});

/* ④ 年払い契約を月払いに切り替えない */
test('年払いの契約は、この口からプランを変更できない（Stripeに書く前に止める）', () => {
  const s = read('app/api/stripe/upgrade/route.ts');
  const guard = s.indexOf("currentInterval !== 'month'");
  const write = s.indexOf('stripe.subscriptions.update(');
  assert.ok(guard > 0, '年払いの判定が無い');
  assert.ok(guard < write, 'Stripeに書いたあとで判定している');
  assert.match(s, /code: 'annual_plan_change_unsupported'/);
  assert.match(s, /\{ status: 409 \}/);
});

/* A/Bテストの勝者を配信側に効かせる */
const AB = "<script>(function(){var k='laru_ab_'+(window.__LHPSID||'x');var v=sessionStorage.getItem(k);var isNew=!v;if(!v){v=Math.random()<0.5?'a':'b';sessionStorage.setItem(k,v);}document.querySelectorAll('[data-ab]').forEach(function(el){if(el.getAttribute('data-ab')!==v)el.style.display='none';});})();</script>";

test('勝者が決まっていれば、乱数の振り分けをその版に固定し、集計への送信を止める', () => {
  const out = applyAbWinner(AB, 'b');
  assert.ok(out.includes("v='b'"), '勝者に固定されていない');
  assert.ok(!out.includes("Math.random()"), '乱数が残っている');
  assert.ok(out.includes('var isNew=false;'), '集計への送信が止まっていない');
});

test('勝者が決まっていなければ、何も変えない', () => {
  assert.equal(applyAbWinner(AB, undefined), AB);
  assert.equal(applyAbWinner(AB, null), AB);
  assert.equal(applyAbWinner(AB, 'c'), AB);
  assert.equal(applyAbWinner('<p>振り分け無し</p>', 'a'), '<p>振り分け無し</p>');
});

test('配信ページが abWinner を通している', () => {
  const s = read('app/hp/[slug]/page.tsx');
  assert.match(s, /const decided = applyAbWinner\(deduped, \(settings as Record<string, unknown>\)\.abWinner\);/);
  assert.match(s, /const eagerHtml = decided\.replace\(/);
});

test('置き換える文字列が、書き出し側の実際の文字列と一致している', () => {
  const exp = read('lib/html-export.ts');
  assert.ok(exp.includes("v=Math.random()<0.5?'a':'b'"), '書き出し側の振り分け文字列が変わった');
  assert.ok(exp.includes('var isNew=!v;'), '書き出し側の isNew が変わった');
});

/* サイト別 sitemap が noIndex を見る */
test('検索に出さないサイトは、サイト別 sitemap も出さない', () => {
  const s = read('app/hp/[slug]/sitemap.xml/route.ts');
  assert.match(s, /if \(settingsForIndex\.noIndex === true\) \{\s*\n\s*return new Response\('Not found', \{ status: 404/);
  const guard = s.indexOf('settingsForIndex.noIndex');
  const emit = s.indexOf('<urlset');
  assert.ok(guard > 0 && guard < emit, 'URLを列挙したあとで判定している');
});

/* パスワード保護サイトのポップアップ */
test('パスワード保護中のサイトの文面は /api/popup から出さない', () => {
  const s = read('app/api/popup/route.ts');
  const guard = s.indexOf("typeof settings.sitePassword === 'string'");
  const emit = s.indexOf('popupScript(');
  assert.ok(guard > 0 && guard < emit, '文面を作る前に止めていない');
  assert.match(s, /return javascript\('\/\/ Protected site', 200\);/);
});

/* 初回サイト作成の預かり */
test('預かった public_id は、サイトへ書けたときだけ空にする', () => {
  const s = read('app/api/sites/route.ts');
  assert.match(s, /\.eq\('id', created\.id\)\.eq\('user_id', user\.id\)\.select\('id'\);/, '書けたかを見ていない');
  assert.match(s, /if \(moved\.error \|\| moved\.data\?\.length !== 1\) \{/);
  // 空にするのは else 側だけ
  const i = s.indexOf('if (moved.error || moved.data?.length !== 1) {');
  const j = s.indexOf('pending_larubot_public_id: null, pending_laruseo_public_id: null', i);
  const k = s.indexOf('} else {', i);
  assert.ok(k > 0 && j > k, '書けなくても空にしている');
  assert.match(s, /kind: 'link', userId: user\.id/, '運営に知らせていない');
});

/* 失敗が画面に出る */
test('版の復元とA/B勝者確定は、失敗したら画面に出る', () => {
  const s = read('app/laruHP/dashboard/DashboardClient.tsx');
  const ab = s.slice(s.indexOf('const handleAbWinner = '), s.indexOf('const handleAudit = '));
  assert.match(ab, /setPublishToast\(\{ message: d\.error \|\| '勝者を確定できませんでした/);
  assert.match(ab, /finally \{\s*setAbWinnerLoading\(null\);/);
  const rs = s.slice(s.indexOf('const handleSnapshotRestore = '), s.indexOf('const handleAudit = ') > s.indexOf('const handleSnapshotRestore = ') ? s.indexOf('const handleAudit = ') : s.length);
  assert.match(rs, /setPublishToast\(\{ message: d\.error \|\| '復元できませんでした/);
  assert.match(rs, /finally \{\s*setSnapshotRestoring\(null\);/);
});

/* 管理画面 */
test('利用者一覧の登録日は auth の値（profiles で上書きしない）', () => {
  const s = read('app/api/admin/users/route.ts');
  const spread = s.indexOf('...profileMap.get(u.id),');
  const created = s.indexOf('created_at: u.created_at,');
  assert.ok(spread > 0 && created > spread, 'profiles の展開が auth の項目より後にある');
});

test('管理画面の契約数は trialing も対象にする（Stripe側の billable と同じ範囲）', () => {
  const s = read('app/api/admin/stats/route.ts');
  assert.match(s, /\.in\('subscription_status', \['active', 'trialing'\]\)/);
  assert.match(read('lib/stripe-truth.ts'), /const BILLABLE = new Set\(\['active', 'trialing'\]\);/);
});
