import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { configuredStripeMode, eventMatchesConfiguredMode } from '../lib/stripe-mode';
import { monthlyAmountOf } from '../lib/stripe-truth';

/**
 * 2026-09-18 の事故そのもの。
 *
 * Stripeの**サンドボックス（テスト環境）**の checkout.session.completed が、
 * 本番の profiles を subscription_status:'active' に書き換えていた。
 * 実売上0円のまま、管理画面は「稼働中1件 / MRR ¥999」と出し続けた。
 *
 * さらに、契約の中身を Stripe から**読めていなかった**のに、
 * 「処理時刻＋6ヶ月」という推測値を契約期間として書いていた。
 *   Stripe上の本当の期間終わり : 2026-09-29
 *   DBに入っていた期間終わり   : 2026-12-29（＝開始日 + ちょうど6ヶ月）
 *
 * 見た目に何も出ないので、誰も気づかなかった。
 */

const WEBHOOK = 'app/api/stripe/webhook/route.ts';
const src = () => readFileSync(WEBHOOK, 'utf8');

test('鍵の先頭から環境を見分ける', () => {
  assert.equal(configuredStripeMode('sk_live_abc'), 'live');
  assert.equal(configuredStripeMode('rk_live_abc'), 'live');
  assert.equal(configuredStripeMode('sk_test_abc'), 'test');
  assert.equal(configuredStripeMode('rk_test_abc'), 'test');
  assert.equal(configuredStripeMode(''), 'unknown');
  assert.equal(configuredStripeMode(undefined), 'unknown');
  assert.equal(configuredStripeMode('pk_live_abc'), 'unknown');
});

test('本番の環境 + 本番のイベント → 通す', () => {
  assert.equal(eventMatchesConfiguredMode(true, 'live'), true);
});

test('【事故の再現】本番の環境 + テストのイベント → 通さない', () => {
  assert.equal(eventMatchesConfiguredMode(false, 'live'), false);
});

test('テストの環境 + テストのイベント → 通す（開発を止めない）', () => {
  assert.equal(eventMatchesConfiguredMode(false, 'test'), true);
});

test('テストの環境 + 本番のイベント → 通さない', () => {
  assert.equal(eventMatchesConfiguredMode(true, 'test'), false);
});

test('環境が分からないときは通さない（迷ったら書かない）', () => {
  assert.equal(eventMatchesConfiguredMode(true, 'unknown'), false);
  assert.equal(eventMatchesConfiguredMode(false, 'unknown'), false);
});

test('webhook が、署名の直後に環境を見ている', () => {
  const s = src();
  const sig = s.indexOf('constructEvent');
  // import 行ではなく、処理の中の呼び出しを見る
  const guard = s.indexOf('if (!eventMatchesConfiguredMode(');
  const firstWrite = s.indexOf("from('profiles').update");
  assert.ok(sig > 0 && guard > 0 && firstWrite > 0, '目印が見つからない');
  assert.ok(guard > sig, '署名検証より前に環境を見ている');
  assert.ok(guard < firstWrite, 'DBを書いたあとで環境を見ている');
});

test('環境違いは 200 で返す（Stripeに再送させ続けない）', () => {
  const s = src();
  const i = s.indexOf('if (!eventMatchesConfiguredMode(');
  const after = s.slice(i, i + 700);
  assert.match(after, /skipped: 'mode_mismatch'/, '飛ばした印が無い');
  assert.ok(!/status:\s*4\d\d/.test(after), '4xx で返すと再送され続ける');
  assert.match(after, /console\.error/, '黙って飛ばしている');
});

test('契約を確認できなければ、有効契約として書かない', () => {
  const s = src();
  assert.ok(!/contractEnd\.setMonth\(contractEnd\.getMonth\(\) \+ 6\)/.test(s),
    '「いま＋6ヶ月」の推測がまだ残っている');
  assert.ok(!/catch \{ \/\* fall through to default \*\/ \}/.test(s),
    'retrieve の失敗をまだ握りつぶしている');
  assert.match(s, /return NextResponse\.json\(\{ error: 'Subscription could not be verified' \}, \{ status: 500 \}\);/,
    '確認できなかったときに再送させていない');
});

test('契約期間は、取れた値だけを書く（取れなければ null）', () => {
  const s = src();
  assert.match(s, /contract_starts_at: startedAt \? new Date\(startedAt \* 1000\)\.toISOString\(\) : null,/);
  assert.match(s, /contract_ends_at: periodEnd \? new Date\(periodEnd \* 1000\)\.toISOString\(\) : null,/);
});

test('記録するのは Stripe が返した契約ID（セッションの値を素通ししない）', () => {
  const s = src();
  assert.match(s, /stripe_subscription_id: sub\.id,/);
  assert.ok(!/stripe_subscription_id: subId \?\? \(session\.subscription as string\)/.test(s),
    '確認していない値をそのまま書いている');
});

test('再送されても二重にならない（同じ値を書くだけ・メールは冪等）', () => {
  const s = src();
  // profiles は update（insert ではない）ので、同じイベントが2回来ても行は増えない
  assert.match(s, /from\('profiles'\)\.update\(profileUpdates\)\.eq\('id', userId\)/);
  // 開始メールは event.id を鍵にしている
  assert.match(s, /`laruhp-subscription-start-\$\{event\.id\}`/);
});

/** MRR は Stripe の実際の請求額から出す */

const sub = (items: unknown[]) => ({ items: { data: items } }) as never;
const item = (unit: number, interval: string, count = 1, quantity = 1) =>
  ({ price: { unit_amount: unit, recurring: { interval, interval_count: count } }, quantity });

test('月額はそのまま', () => {
  assert.equal(monthlyAmountOf(sub([item(999, 'month')])), 999);
});

test('年額は12で割って月額に均す', () => {
  assert.equal(monthlyAmountOf(sub([item(9990, 'year')])), 833);
});

test('複数明細と数量を足す', () => {
  assert.equal(monthlyAmountOf(sub([item(999, 'month'), item(4980, 'month', 1, 2)])), 999 + 9960);
});

test('金額の無い明細で落ちない', () => {
  assert.equal(monthlyAmountOf(sub([{ price: null, quantity: 1 }])), 0);
  assert.equal(monthlyAmountOf(sub([])), 0);
});

/** 管理画面の数字 */

const STATS = 'app/api/admin/stats/route.ts';

test('契約数とMRRを、固定価格表ではなくStripeから出している', () => {
  const s = readFileSync(STATS, 'utf8');
  assert.ok(!/mrr \+= PLAN_PRICE/.test(s), 'まだ固定価格表でMRRを出している');
  assert.match(s, /fetchStripeTruth\(\)/, 'Stripeに問い合わせていない');
  assert.match(s, /mrr \+= live\.monthlyAmount;/, 'Stripeの実請求額を使っていない');
});

test('Stripeに無い契約は、契約数にもMRRにも入れない', () => {
  const s = readFileSync(STATS, 'utf8');
  assert.match(s, /^\s*if \(!live\) \{$/m, 'Stripeに無い契約を弾いていない');
  assert.match(s, /unverified\.push\(/, '食い違いを記録していない');
  assert.match(s, /activeUsers: truth\.ok \? verifiedCount : 0,/, '照合前の件数を出している');
});

test('Stripeに聞けなかったとき、DBの数字をMRRとして出さない', () => {
  const s = readFileSync(STATS, 'utf8');
  // mrr の加算は truth.ok の中だけ
  const block = s.slice(s.indexOf('if (truth.ok) {'), s.lastIndexOf('return NextResponse.json({'));
  assert.ok(block.includes('mrr += live.monthlyAmount;'), 'MRRの加算が照合の外にある');
  assert.match(s, /stripe: \{\s*\n\s*ok: truth\.ok,/, '照合できたかを返していない');
});

test('画面が、照合できていないMRRを金額として出さない', () => {
  for (const p of ['app/admin/page.tsx', 'app/laruHP/admin/page.tsx']) {
    const s = readFileSync(p, 'utf8');
    assert.match(s, /stats\.stripe && !stats\.stripe\.ok \? '確認できません'/, `${p} が金額を出し続ける`);
  }
});

test('食い違いが画面に出る', () => {
  const s = readFileSync('app/laruHP/admin/page.tsx', 'utf8');
  assert.match(s, /Stripeに課金中の契約が無い人が/, '食い違いの件数を出していない');
  assert.match(s, /Stripeに問い合わせできませんでした/, '照合失敗を出していない');
});

test('価格の確認画面が、どちらの環境の鍵かを返す', () => {
  const s = readFileSync('app/api/admin/price-check/route.ts', 'utf8');
  assert.match(s, /byStripe/, 'Stripeが返す livemode を見ていない');
  assert.match(s, /livemode: price\.livemode,/, '価格の livemode を拾っていない');
  assert.match(s, /agrees: byPrefix === byStripe,/, '鍵の先頭とStripeの値を突き合わせていない');
  assert.ok(!/STRIPE_SECRET_KEY\s*\}/.test(s), '鍵の値を返している');
});

test('もう1つのStripeの口（予約・注文）も環境を見ている', () => {
  const s2 = readFileSync('app/api/stripe/scheduling-webhook/route.ts', 'utf8');
  const sig = s2.indexOf('constructEvent');
  const guard = s2.indexOf('if(!eventMatchesConfiguredMode(');
  const firstWrite = s2.indexOf('db.from(');
  assert.ok(guard > sig, '署名検証より前に見ている');
  assert.ok(guard < firstWrite, 'DBを書いたあとで見ている');
  assert.match(s2, /skipped:'mode_mismatch'/);
});

/**
 * Stripeに存在しない契約を、運営が片付けられること。
 * ここが塞がっていたので、今回の1件はDBを手で書き換えるしかなかった。
 */

const ADMIN_USER = 'app/api/admin/users/[id]/route.ts';

test('Stripeが「無い」と言った契約だけ、Stripeに触らず片付ける', () => {
  const s = readFileSync(ADMIN_USER, 'utf8');
  assert.match(s, /code === 'resource_missing' \|\| status === 404/, '無い契約を見分けていない');
  assert.match(s, /missingInStripe = true;/);
  // それ以外の失敗は今までどおり止める
  assert.match(s, /return NextResponse\.json\(\{ error: 'Stripeの解約を確定できませんでした' \}, \{ status: 502 \}\);/,
    '通信不良まで消してしまう');
});

test('片付けるときに契約期間も消す（古い期限を残さない）', () => {
  const s = readFileSync(ADMIN_USER, 'utf8');
  const block = s.slice(s.indexOf("subscription_status: 'canceled',"), s.indexOf(".eq('id', id).eq('stripe_subscription_id', subscriptionId)"));
  for (const f of ['stripe_subscription_id: null', 'plan: null', 'contract_starts_at: null', 'contract_ends_at: null']) {
    assert.ok(block.includes(f), `${f} を消していない`);
  }
});

test('片付けても、他のプロフィール情報は消さない', () => {
  const s = readFileSync(ADMIN_USER, 'utf8');
  const block = s.slice(s.indexOf("subscription_status: 'canceled',"), s.indexOf(".eq('id', id).eq('stripe_subscription_id', subscriptionId)"));
  for (const keep of ['business_name', 'stripe_customer_id', 'features', 'admin_notes', 'brand_logo_url']) {
    assert.ok(!block.includes(keep), `${keep} まで消している`);
  }
});

test('対象は1行だけ（契約IDでも絞る）', () => {
  const s = readFileSync(ADMIN_USER, 'utf8');
  assert.match(s, /\.eq\('id', id\)\.eq\('stripe_subscription_id', subscriptionId\)\.select\('id'\)/,
    '利用者IDだけで書き換えている');
});
