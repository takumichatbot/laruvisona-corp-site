// 申し込み〜決済〜解約を、人の手を使わずに最後まで通す。
//
// なぜ要るか。
// この道筋は「課金は通ったのに何かが用意されていない」という形で壊れる。
// 画面には何も出ないので、実際に通してみるまで誰も気づけない。
// 実カードで確かめるには人が最後のボタンを押す必要があり、しかも
// 押すたびに本物の請求が立つので、何度も回せない。
//
// そこで Stripe・Supabase・メール・LARUbot を替え玉に差し替え、
// **こちらのコードだけを本物のまま**通す。
// 替え玉でないのは次のとおり:
//   ・webhookの署名検証（本物の stripe.webhooks.constructEvent）
//   ・プラン付与、契約期間の計算、メール本文、LARUbot登録の中身
//
// 確かめないと決めたこと:
//   ・Stripeのカード入力画面そのもの（向こう側の画面で、こちらの資産ではない）
//   ・Stripeが実際にその価格で請求するか（scripts/check-laruhp-production 側の
//     price-check が本番の価格IDを読んで確かめている）
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const APP = process.env.APP_URL || 'http://127.0.0.1:3100';
const SERVICES = process.env.SERVICES_URL || 'http://127.0.0.1:54998';
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
assert.ok(WEBHOOK_SECRET, 'STRIPE_WEBHOOK_SECRET が渡っていない');

const ids = await (await fetch(`${SERVICES}/__ids`)).json();
const state = async () => (await fetch(`${SERVICES}/__state`)).json();
const reset = async () => fetch(`${SERVICES}/__reset`, { method: 'POST' });
const profileOf = async id => (await state()).profiles.find(p => p.id === id);

let eventCounter = 0;

/** Stripeが送るのと同じ形の署名を付けて、本物のwebhookルートへ投げる */
async function deliver(type, object, { secret = WEBHOOK_SECRET, id } = {}) {
  const eventId = id || `evt_test_${++eventCounter}`;
  const payload = JSON.stringify({
    id: eventId, object: 'event', type, created: Math.floor(Date.now() / 1000),
    data: { object },
  });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto.createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  const res = await fetch(`${APP}/api/stripe/webhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'stripe-signature': `t=${timestamp},v1=${signature}` },
    body: payload,
  });
  return { status: res.status, body: await res.text(), eventId };
}

const checkoutSession = (over = {}) => ({
  id: 'cs_test_1', object: 'checkout.session', mode: 'subscription',
  subscription: 'sub_test_hp', customer: 'cus_test', payment_status: 'paid',
  metadata: { supabase_user_id: ids.userId, site_id: ids.siteId, plan: 'hp-bot' },
  ...over,
});

const results = [];
async function step(name, fn) {
  try { await fn(); results.push(['ok', name]); }
  catch (error) { results.push(['NG', name, error.message]); }
}

// ───────────────────────────────────────────────────────────
await step('偽の署名では受け付けない', async () => {
  await reset();
  const res = await deliver('checkout.session.completed', checkoutSession(), { secret: 'whsec_wrong' });
  assert.equal(res.status, 400, `署名が違うのに ${res.status} を返した`);
  const profile = await profileOf(ids.userId);
  assert.equal(profile.subscription_status, 'inactive', '署名が違うのに契約が有効になった');
});

await step('契約が通ると、プランと契約期間が入る', async () => {
  await reset();
  const res = await deliver('checkout.session.completed', checkoutSession());
  assert.equal(res.status, 200, res.body);
  const profile = await profileOf(ids.userId);
  assert.equal(profile.plan, 'hp-bot');
  assert.equal(profile.subscription_status, 'active');
  assert.equal(profile.stripe_subscription_id, 'sub_test_hp');
  assert.equal(profile.stripe_customer_id, 'cus_test');
  // 契約の始まりは start_date。current_period_start だと、請求のたびに
  // 前へ動いて最低利用期間が明けなくなる。
  assert.equal(profile.contract_starts_at, new Date(1789000000 * 1000).toISOString(),
    'contract_starts_at が current_period_start を見ている（請求のたびに前へ動く）');
  assert.equal(profile.contract_ends_at, new Date(1794184000 * 1000).toISOString());
});

await step('契約が通ると、開始メールが正しい宛先へ1通', async () => {
  const sent = (await state()).calls.email;
  assert.equal(sent.length, 1, `メールが ${sent.length} 通`);
  assert.equal(sent[0].to, 'customer@example.test');
  assert.equal(sent[0].subject, '【LARU HP】サブスクリプションを開始しました');
  // 画面の料金表と、メールに書く料金がずれていないこと
  assert.ok(sent[0].html.includes('4,980'), 'hp-bot の月額がメールに出ていない');
  assert.ok(sent[0].html.includes('初月無料'), '初月無料の断りがメールに無い');
});

await step('LARUbotが付くプランなら、登録が飛ぶ', async () => {
  const calls = (await state()).calls.larubot;
  assert.equal(calls.length, 1, `LARUbot登録が ${calls.length} 回`);
  assert.equal(calls[0].secretSent, true, '合言葉を付けずに送っている');
  assert.equal(calls[0].body.plan, 'hp-bot');
  assert.equal(calls[0].body.user_id, ids.userId);
  assert.equal(calls[0].body.site_id, ids.siteId);
  // 空の屋号で登録すると、LARUbot側で誰のものか分からなくなる
  assert.equal(calls[0].body.site_name, 'テスト工務店');
  assert.equal(calls[0].body.email, 'customer@example.test');
});

await step('同じ通知が二度届いても、メールが二重にならない', async () => {
  // Stripeは同じイベントを何度でも再送する。こちらは受け取りを拒めない。
  const before = (await state()).calls.email;
  await deliver('checkout.session.completed', checkoutSession(), { id: 'evt_replay' });
  await deliver('checkout.session.completed', checkoutSession(), { id: 'evt_replay' });
  const after = (await state()).calls.email;
  const keys = after.slice(before.length).map(mail => mail.idempotencyKey);
  assert.equal(new Set(keys).size, 1, `同じイベントなのに鍵が違う: ${JSON.stringify(keys)}`);
  assert.match(keys[0], /^laruhp-subscription-start-evt_replay$/);
});

await step('LARUbotが無いプランでは、登録を飛ばす', async () => {
  await reset();
  await deliver('checkout.session.completed', checkoutSession({
    metadata: { supabase_user_id: ids.userId, site_id: ids.siteId, plan: 'hp' },
  }));
  const calls = (await state()).calls.larubot;
  assert.equal(calls.length, 0, 'HP単体なのにLARUbotへ登録している');
  const profile = await profileOf(ids.userId);
  assert.equal(profile.plan, 'hp');
});

await step('運営の契約は、課金の対象にしない', async () => {
  await reset();
  await deliver('checkout.session.completed', checkoutSession({
    metadata: { supabase_user_id: ids.adminUserId, site_id: ids.siteId, plan: 'hp-bot' },
  }));
  const profile = await profileOf(ids.adminUserId);
  assert.equal(profile.subscription_status, 'inactive', '運営の行を書き換えている');
  assert.equal((await state()).calls.email.length, 0);
});

await step('支払いが落ちると past_due になり、本人へ知らせる', async () => {
  await reset();
  await deliver('checkout.session.completed', checkoutSession());
  await deliver('invoice.payment_failed', {
    id: 'in_test_1', object: 'invoice', subscription: 'sub_test_hp',
  });
  const profile = await profileOf(ids.userId);
  assert.equal(profile.subscription_status, 'past_due');
  const sent = (await state()).calls.email;
  assert.equal(sent.at(-1).subject, '【LARU HP】お支払いに失敗しました');
  assert.equal(sent.at(-1).to, 'customer@example.test');
});

await step('支払いが通ると active に戻り、契約終わりが伸びる', async () => {
  await deliver('invoice.payment_succeeded', {
    id: 'in_test_2', object: 'invoice', subscription: 'sub_test_hp',
    lines: { data: [{ period: { end: 1796776000 } }] },
  });
  const profile = await profileOf(ids.userId);
  assert.equal(profile.subscription_status, 'active');
  assert.equal(profile.contract_ends_at, new Date(1796776000 * 1000).toISOString());
});

await step('プランを上げると、プランが入れ替わって知らせが飛ぶ', async () => {
  await deliver('customer.subscription.updated', {
    id: 'sub_test_hp', object: 'subscription', status: 'active', customer: 'cus_test',
    metadata: { plan: 'hp-bot-seo' },
  });
  const profile = await profileOf(ids.userId);
  assert.equal(profile.plan, 'hp-bot-seo');
  assert.equal(profile.subscription_status, 'active');
  const sent = (await state()).calls.email;
  assert.equal(sent.at(-1).subject, '【LARU HP】プランを変更しました');
  assert.ok(sent.at(-1).html.includes('9,800'), '変更後の月額がメールに出ていない');
});

await step('解約すると、プランも契約IDも消えて知らせが飛ぶ', async () => {
  await deliver('customer.subscription.deleted', {
    id: 'sub_test_hp', object: 'subscription', status: 'canceled', customer: 'cus_test', metadata: {},
  });
  const profile = await profileOf(ids.userId);
  assert.equal(profile.subscription_status, 'canceled');
  assert.equal(profile.plan, null, '解約したのにプランが残っている');
  assert.equal(profile.stripe_subscription_id, null, '解約したのに契約IDが残っている');
  const sent = (await state()).calls.email;
  assert.equal(sent.at(-1).subject, '【LARU HP】サブスクリプションを解約しました');
});

await step('知らないユーザーの通知で、他人の行を書き換えない', async () => {
  await reset();
  const res = await deliver('checkout.session.completed', checkoutSession({
    metadata: { supabase_user_id: '99999999-9999-4999-8999-999999999999', site_id: ids.siteId, plan: 'hp-bot' },
  }));
  // 該当が0件なら失敗として返し、Stripeに再送させる（黙って200を返さない）
  assert.equal(res.status, 500, `該当0件なのに ${res.status} を返した`);
  const profile = await profileOf(ids.userId);
  assert.equal(profile.subscription_status, 'inactive');
});

// ───────────────────────────────────────────────────────────
let failed = 0;
for (const [mark, name, detail] of results) {
  if (mark === 'ok') console.log(`  ok   ${name}`);
  else { failed++; console.log(`  NG   ${name}\n       ${detail}`); }
}
console.log('---');
console.log(`通過 ${results.length - failed} / 失敗 ${failed}`);
if (failed) { console.log('BILLING SCENARIO FAILED'); process.exit(1); }
console.log('ALL BILLING SCENARIO STEPS PASSED');
