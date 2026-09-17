import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

/**
 * 「一度やめたお客様が、二度と買えない」を作らない。
 *
 * 2026-09-17、本番の checkout を叩いたら 500 が返り、中身はこれだった。
 *
 *   Keys for idempotent requests can only be used with the same parameters
 *   they were first used with. Try using a key other than
 *   'laruhp-checkout-<利用者のUUID>-hp-monthly'
 *
 * 鍵が `利用者-プラン-支払方法` の固定だった。
 * Stripe は鍵を24時間覚えていて、**同じ鍵で中身が少しでも違うと拒否する。**
 *
 * 中身が変わる場面は、ふつうに起きる。
 *   ・別のサイトの「公開する」から入り直した（戻り先URLに siteId が入る）
 *   ・初月無料クーポンの有無が変わった
 *   ・値段を変えた
 *
 * つまり、買おうとして一度やめたお客様が、24時間以内に別の入口から
 * 入り直すと **買えない**。しかも出るのは英語のエラーで、
 * こちらの利用者IDまで画面に載っていた。
 */

const read = (p: string) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const route = read('app/api/stripe/checkout/route.ts');

test('鍵を、注文の中身から作る', () => {
  assert.doesNotMatch(route, /idempotencyKey: `laruhp-checkout-\$\{user\.id\}-\$\{plan\}-\$\{billing\}`/,
    '固定の鍵に戻っている');
  assert.match(route, /idempotencyKey: checkoutKey\(user\.id, sessionParams\)/);
  assert.match(route, /createHash\('sha256'\)\.update\(JSON\.stringify\(params\)\)/);
});

test('中身が違えば、鍵も違う', () => {
  // route.ts と同じ作り方で確かめる。
  const key = (userId: string, params: unknown) =>
    `laruhp-checkout-${userId}-${createHash('sha256').update(JSON.stringify(params)).digest('hex').slice(0, 32)}`;

  const base = { plan: 'hp', success_url: 'https://x/laruHP/dashboard?payment=success' };
  const fromSite = { plan: 'hp', success_url: 'https://x/laruHP/builder?siteId=abc&payment=success' };

  assert.equal(key('u1', base), key('u1', base), '同じ注文は同じ鍵（二度押しで2つ作らない）');
  assert.notEqual(key('u1', base), key('u1', fromSite), '別の入口から入ると、別の鍵になること');
  assert.notEqual(key('u1', base), key('u2', base), '人が違えば別の鍵');
});

test('Stripeの生の文面を、画面へ返さない', () => {
  // 英語のうえ、こちらの利用者IDが載る。
  assert.doesNotMatch(route, /error: stripeErr\?\.message/);
  assert.match(route, /お支払い画面を開けませんでした/);
  // 追いかけるための印は、ログにだけ残す。
  assert.match(route, /console\.error\('\[stripe\/checkout\] error:'/);
});
