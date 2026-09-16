import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hasServiceAccess } from '../lib/subscription-access.ts';
import { siteCreationAccess } from '../lib/site-creation-access.ts';

test('使ってよいのは active と trialing だけ', () => {
  assert.equal(hasServiceAccess('active'), true);
  assert.equal(hasServiceAccess('trialing'), true);
  assert.equal(hasServiceAccess('past_due'), false);
  assert.equal(hasServiceAccess('canceled'), false);
  assert.equal(hasServiceAccess('inactive'), false);
  assert.equal(hasServiceAccess(null), false);
  assert.equal(hasServiceAccess(undefined), false);
});

test('試用中でも、作るのと公開するのが食い違わない', () => {
  // 作れる側
  assert.equal(siteCreationAccess('a@example.com', 'hp', 'trialing', []).allowed, true);
  // 公開する側。以前はここが active 限定で、作れるのに公開できなかった
  const route = readFileSync(new URL('../app/api/sites/[id]/publish/route.ts', import.meta.url), 'utf8');
  assert.match(route, /hasServiceAccess\(profile\?\.subscription_status\)/);
  assert.doesNotMatch(route, /subscription_status !== 'active'/);
});

test('契約の判定を場所ごとに書き直していない', () => {
  const files = [
    '../app/api/ai/blog-generate/route.ts',
    '../app/api/ai/section-proposal/route.ts',
    '../lib/site-creation-access.ts',
    '../app/laruHP/plans/page.tsx',
  ];
  for (const path of files) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.match(source, /hasServiceAccess/, path);
    assert.doesNotMatch(source, /\['active', 'trialing'\]/, path);
  }
});

test('公開は、はじめての1回だけ知らせる', () => {
  const route = readFileSync(new URL('../app/api/sites/[id]/publish/route.ts', import.meta.url), 'utf8');
  // 公開済みのサイトを直して再公開しても送らない
  assert.match(route, /if \(!site\.published && user\.email\)/);
  // 何度公開し直しても1通だけ
  assert.match(route, /idempotencyKey: `laruhp-site-published-\$\{id\}`/);
});

test('決済のあとは、作りかけのサイトへ戻す', () => {
  const route = readFileSync(new URL('../app/api/stripe/checkout/route.ts', import.meta.url), 'utf8');
  assert.match(route, /\/laruHP\/builder\?siteId=\$\{ownedSiteId\}&payment=success/);
});

test('計測の署名鍵が無くても、顧客の公開サイトは出す', () => {
  // ここが投げると、顧客のサイトが丸ごと500になる
  const page = readFileSync(new URL('../app/hp/[slug]/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /try \{ analyticsToken = signAnalyticsSite\(slug\); \}/);
  assert.match(page, /\{analyticsToken && \(/);
});

test('自動更新される契約を「もうすぐ終わる」と言わない', () => {
  const dash = readFileSync(new URL('../app/laruHP/dashboard/DashboardClient.tsx', import.meta.url), 'utf8');
  assert.match(dash, /const nearExpiry = isCanceled &&/);
});
