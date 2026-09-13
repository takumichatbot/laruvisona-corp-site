import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  escapeNewsletterHtml,
  newsletterSubscriberInSegment,
  newsletterVariantFor,
  parseNewsletterSend,
  parseNewsletterSubscription,
  signNewsletterUnsubscribe,
  verifyNewsletterUnsubscribe,
} from '../lib/newsletter-contract.ts';

const siteId = '11111111-1111-4111-8111-111111111111';
const subscriberId = '22222222-2222-4222-8222-222222222222';
const requestId = '33333333-3333-4333-8333-333333333333';
const secret = 's'.repeat(32);

test('登録入力を整形し、壊れたサイト・メール・長すぎる名前を拒否する', () => {
  assert.deepEqual(parseNewsletterSubscription({ siteId, email: ' USER@Example.com ', name: ' 齋藤 ' }), {
    siteId, email: 'user@example.com', name: '齋藤',
  });
  assert.throws(() => parseNewsletterSubscription({ siteId: 'x', email: 'user@example.com' }));
  assert.throws(() => parseNewsletterSubscription({ siteId, email: 'invalid' }));
  assert.throws(() => parseNewsletterSubscription({ siteId, email: 'user@example.com', name: 'a'.repeat(101) }));
});

test('送信入力は平文本文・対象区分・一意な送信識別子を必須にする', () => {
  assert.deepEqual(parseNewsletterSend({ siteId, requestId, subject: ' A ', subjectB: ' B ', body: ' 本文 ', segment: 'new' }), {
    siteId, requestId, subject: 'A', subjectB: 'B', body: '本文', segment: 'new',
  });
  assert.throws(() => parseNewsletterSend({ siteId, requestId: 'bad', subject: 'A', body: '本文' }));
  assert.throws(() => parseNewsletterSend({ siteId, requestId, subject: 'A', body: '本文', segment: 'vip' }));
  assert.throws(() => parseNewsletterSend({ siteId, requestId, subject: 'A', body: 'x'.repeat(100001) }));
});

test('登録期間の区分は境界を重ねず一人を一群だけにする', () => {
  const now = Date.parse('2026-09-14T00:00:00Z');
  const daysAgo = (days: number) => new Date(now - days * 86_400_000).toISOString();
  assert.equal(newsletterSubscriberInSegment(daysAgo(30), 'new', now), true);
  assert.equal(newsletterSubscriberInSegment(daysAgo(30), 'mid', now), false);
  assert.equal(newsletterSubscriberInSegment(daysAgo(31), 'mid', now), true);
  assert.equal(newsletterSubscriberInSegment(daysAgo(90), 'mid', now), true);
  assert.equal(newsletterSubscriberInSegment(daysAgo(91), 'veteran', now), true);
});

test('A/Bの割当は再試行しても同じで、十分な宛先を両群へ分ける', () => {
  const values = Array.from({ length: 100 }, (_, index) => newsletterVariantFor(`user${index}@example.com`, requestId, true));
  assert.ok(values.includes('A'));
  assert.ok(values.includes('B'));
  assert.deepEqual(values, Array.from({ length: 100 }, (_, index) => newsletterVariantFor(`USER${index}@EXAMPLE.COM`, requestId, true)));
  assert.equal(newsletterVariantFor('user@example.com', requestId, false), 'A');
});

test('配信停止URLはメールを含まず、改ざん・期限切れ・別鍵を拒否する', () => {
  const expiresAt = Date.now() + 60_000;
  const token = signNewsletterUnsubscribe({ siteId, subscriberId, expiresAt }, secret);
  assert.doesNotMatch(token, /@|example/i);
  assert.deepEqual(verifyNewsletterUnsubscribe(token, secret, expiresAt - 1), { siteId, subscriberId, expiresAt });
  assert.equal(verifyNewsletterUnsubscribe(`${token}x`, secret), null);
  assert.equal(verifyNewsletterUnsubscribe(token, 'x'.repeat(32)), null);
  assert.equal(verifyNewsletterUnsubscribe(token, secret, expiresAt + 1), null);
});

test('メール本文へ入力したHTMLは実行可能な形で入らない', () => {
  assert.equal(escapeNewsletterHtml('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
});

test('公開登録と解除はservice経路・公開サイト確認・署名トークンを使う', () => {
  const route = fs.readFileSync(new URL('../app/api/newsletter/subscribe/route.ts', import.meta.url), 'utf8');
  assert.match(route, /createServiceClient\(\)/);
  assert.match(route, /\.eq\('published', true\)/);
  assert.match(route, /verifyNewsletterUnsubscribe\(token, secret\(\)\)/);
  assert.match(route, /data\?\.length !== 1/);
  assert.doesNotMatch(route, /searchParams\.get\('email'\)/);
});

test('A/B配信は一度の要求で分割し、成功したメールだけを数える', () => {
  const api = fs.readFileSync(new URL('../app/api/newsletter/send/route.ts', import.meta.url), 'utf8');
  assert.match(api, /newsletterVariantFor\(subscriber\.email/);
  assert.match(api, /Promise\.allSettled/);
  assert.match(api, /idempotencyKey: `newsletter-/);
  assert.match(api, /counts\[item\.variant\]\+\+/);
  assert.doesNotMatch(api, /sent \+= batch\.length/);
  assert.match(api, /List-Unsubscribe-Post/);
  const page = fs.readFileSync(new URL('../app/laruHP/newsletter/page.tsx', import.meta.url), 'utf8');
  const handler = page.slice(page.indexOf('const handleSend'), page.indexOf('const filtered'));
  assert.equal((handler.match(/fetch\('\/api\/newsletter\/send'/g) || []).length, 1);
  assert.match(handler, /subjectB: abTestMode/);
  assert.match(handler, /segment: sendSegment/);
  assert.match(handler, /requestId: sendRequestId\.current/);
});

test('ニュースレター表と権限をSQLから再現できる', () => {
  const sql = fs.readFileSync(new URL('../supabase/hp_newsletter.sql', import.meta.url), 'utf8');
  assert.match(sql, /create table if not exists public\.newsletter_campaigns/);
  assert.match(sql, /create table if not exists public\.newsletter_email_events/);
  assert.match(sql, /revoke all on public\.newsletter_subscribers from anon, authenticated/);
  assert.match(sql, /unique\(site_id,request_id,variant\)/);
  assert.match(sql, /laruhp_newsletter_set_paused/);
  const runner = fs.readFileSync(new URL('../supabase/run-sql-regression.sh', import.meta.url), 'utf8');
  assert.match(runner, /hp_newsletter\.sql/);
  assert.match(runner, /hp_newsletter_regression\.sql/);
});

test('配信停止は端末だけでなくサイト設定へ保存し、送信APIでも強制する', () => {
  const settings = fs.readFileSync(new URL('../app/api/newsletter/settings/route.ts', import.meta.url), 'utf8');
  assert.match(settings, /eq\('user_id', user\.id\)/);
  assert.match(settings, /rpc\('laruhp_newsletter_set_paused'/);
  const send = fs.readFileSync(new URL('../app/api/newsletter/send/route.ts', import.meta.url), 'utf8');
  assert.match(send, /newsletter_paused === true/);
  assert.match(send, /status: 409/);
  const page = fs.readFileSync(new URL('../app/laruHP/newsletter/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /fetch\('\/api\/newsletter\/settings'/);
  assert.match(page, /fetch\(`\/api\/newsletter\/settings\?siteId=/);
  assert.doesNotMatch(page, /laruHP_newsletter_paused/);
});

test('Resend通知は署名本文を検証し、同じイベントを重複計上しない', () => {
  const route = fs.readFileSync(new URL('../app/api/resend/webhook/route.ts', import.meta.url), 'utf8');
  assert.match(route, /webhooks\.verify\(/);
  assert.match(route, /svix-id/);
  assert.match(route, /svix-timestamp/);
  assert.match(route, /svix-signature/);
  assert.match(route, /onConflict: 'resend_email_id,event_type'/);
  assert.match(route, /updated\?\.length !== 1/);
  assert.doesNotMatch(route, /Simple presence check|if \(!signature\)/);
});
