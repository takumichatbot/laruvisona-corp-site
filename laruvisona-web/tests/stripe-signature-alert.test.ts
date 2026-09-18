import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { alertStripeSignatureFailure, SIGNATURE_ALERT_WINDOW_SEC } from '../lib/stripe-signature-alert';

/**
 * 本番の STRIPE_WEBHOOK_SECRET が送信先と一致しているかは、
 * 本番の決済が来るまで確かめられない。一致していなければ、
 * 最初のお客様の決済が署名で弾かれて、契約が有効にならないまま
 * **誰にも知らされない**。ここはそれを知らせる。
 */

const WEBHOOK = 'app/api/stripe/webhook/route.ts';
const LIB = 'lib/stripe-signature-alert.ts';

/** claimPublicRate の返り値を差し替えられる、最小の db の代わり */
function fakeDb(outcome: 'allowed' | 'limited' | 'unavailable') {
  // claimPublicRate は db.rpc(...) を呼ぶ。ここでは lib を直接読まず、
  // 環境変数を外して「送れない側」に倒す検査と、抑制の判断の検査に分ける。
  return { __outcome: outcome } as unknown as import('@supabase/supabase-js').SupabaseClient;
}

test('通知の送り先や鍵が無いときは、送らずに unavailable を返す（投げない）', async () => {
  const saved = { to: process.env.ADMIN_EMAIL, key: process.env.RESEND_API_KEY };
  delete process.env.ADMIN_EMAIL; delete process.env.RESEND_API_KEY;
  try {
    const r = await alertStripeSignatureFailure(fakeDb('allowed'), {
      endpoint: '/api/stripe/webhook', hadSignatureHeader: true, errorName: 'StripeSignatureVerificationError',
    });
    assert.equal(r, 'unavailable');
  } finally {
    if (saved.to) process.env.ADMIN_EMAIL = saved.to;
    if (saved.key) process.env.RESEND_API_KEY = saved.key;
  }
});

test('署名検証の失敗で通知を呼び、400 は今までどおり返す', () => {
  const s = readFileSync(WEBHOOK, 'utf8');
  const i = s.indexOf('constructEvent');
  const block = s.slice(i, s.indexOf('const stripeMode = configuredStripeMode();'));
  assert.match(block, /await alertStripeSignatureFailure\(/, '通知を呼んでいない');
  assert.match(block, /return NextResponse\.json\(\{ error: 'Invalid signature' \}, \{ status: 400 \}\);/, '400 を変えている');
  // 通知が 400 より前（通知してから返す）
  assert.ok(block.indexOf('alertStripeSignatureFailure') < block.indexOf("status: 400"), '返してから通知している');
});

test('通知に、署名ヘッダ・本文・鍵・Cookie を渡していない', () => {
  const s = readFileSync(WEBHOOK, 'utf8');
  const i = s.indexOf('await alertStripeSignatureFailure(');
  const call = s.slice(i, s.indexOf('});', i) + 3);
  // 署名の値そのもの（sig）を渡していないこと。「!!sig」（有無）だけは許す
  const withoutFlag = call.replace('hadSignatureHeader: !!sig,', '');
  for (const leak of ['body', 'sig', 'STRIPE_WEBHOOK_SECRET', 'cookie', 'authorization', 'headers.get(']) {
    assert.ok(!withoutFlag.includes(leak), `通知の引数に ${leak} が混ざっている`);
  }
  assert.match(call, /hadSignatureHeader: !!sig,/, 'ヘッダは「有無」だけ渡す');
});

test('通知の本文に入るのは最小限の項目だけ', () => {
  const s = readFileSync(LIB, 'utf8');
  // 通知に載せる行の定義
  const i = s.indexOf('const lines: Array<[string, string]>');
  const lines = s.slice(i, s.indexOf('];', i));
  for (const ok of ['受け口', '発生時刻', '署名ヘッダ', 'エラーの種類']) assert.ok(lines.includes(ok), `${ok} が無い`);
  for (const bad of ['failure.body', 'signature:', 'whsec', 'Authorization', 'Cookie', 'clientIp', 'x-forwarded-for', 'user-agent']) {
    assert.ok(!lines.includes(bad), `${bad} を載せている`);
  }
});

test('同じ受け口は1時間に1通（既存の claimPublicRate を使う）', () => {
  const s = readFileSync(LIB, 'utf8');
  assert.equal(SIGNATURE_ALERT_WINDOW_SEC, 3600);
  assert.match(s, /claimPublicRate\(db, 'stripe-sig-alert', failure\.endpoint, 1, SIGNATURE_ALERT_WINDOW_SEC\)/,
    '抑制の鍵が受け口ではない、または回数が1ではない');
  assert.match(s, /if \(rate === 'limited'\) return 'suppressed';/);
  // 抑制の仕組みが使えないときは送らない（爆発する側に倒さない）
  assert.match(s, /if \(rate === 'unavailable'\) \{[\s\S]*?return 'unavailable';/);
});

test('送信元IPを自前で管理していない', () => {
  const s = readFileSync(LIB, 'utf8');
  assert.ok(!/x-forwarded-for|clientIp|STRIPE_IPS|allowlist/i.test(s), 'IPの一覧や取得が入っている');
});

test('Resend の冪等キーが時間の窓ごとに決まる（再送で二重に出ない）', () => {
  const s = readFileSync(LIB, 'utf8');
  assert.match(s, /idempotencyKey: `stripe-sig-fail-\$\{failure\.endpoint\}-\$\{Math\.floor\(at\.getTime\(\) \/ \(SIGNATURE_ALERT_WINDOW_SEC \* 1000\)\)\}`/);
});
