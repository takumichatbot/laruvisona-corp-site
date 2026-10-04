import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  syncPublicationTarget, registerWhenReady, ptEligibility, seoActive,
  PT_EXCLUDED_PUBLIC_IDS, PT_EXCLUDED_SITE_IDS,
} from '../lib/publication-target-sync';

process.env.LARU_HP_API_SECRET = 'unit-test-secret';
process.env.LARUBOT_API_URL = 'https://laru.test';
delete process.env.HP_ARTICLES_READY_ORIGIN;

const SITE = { id: '11111111-1111-4111-8111-111111111111', slug: 'midori', custom_domain: 'midori-dental.jp', settings_json: { laruseoPublicId: 'pid-1', laruseo: true } };
type Call = { url: string; method: string; headers: Headers; body: Record<string, unknown> | null };
function harness(replies: Array<{ status: number; body?: unknown } | 'throw'>, opts: { articles?: number } = {}) {
  const calls: Call[] = [], logs: string[] = [], sleeps: number[] = [];
  let i = 0;
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, method: init?.method || 'GET', headers: new Headers(init?.headers), body: init?.body ? JSON.parse(String(init.body)) : null });
    if (url.endsWith('/articles')) return new Response('', { status: opts.articles ?? 200 });
    const r = replies[Math.min(i++, replies.length - 1)];
    if (r === 'throw') throw new Error('timeout');
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return { calls, logs, sleeps, deps: { fetch: fetchImpl, sleep: async (ms: number) => { sleeps.push(ms); }, log: (_l: string, line: Record<string, unknown>) => { logs.push(JSON.stringify(line)); } } };
}
const OK = (extra: Record<string, unknown> = {}) => ({ status: 200, body: { ok: true, changed: true, registration: { registered: true, state: 'active', redirects_to_hp: true }, ...extra } });

test('register：仕様どおりの口・鍵のヘッダー・body（canonical_base・article_path）', async () => {
  const h = harness([OK()]);
  const r = await syncPublicationTarget(SITE, 'register', { event: 'site_published', ownerSeo: true }, h.deps);
  assert.equal(r.kind, 'done');
  assert.equal(h.calls[0].url, 'https://laru.test/api/hp/seo/publication-target');
  assert.equal(h.calls[0].method, 'POST');
  assert.equal(h.calls[0].headers.get('x-laru-secret'), 'unit-test-secret');
  assert.deepEqual(h.calls[0].body, { public_id: 'pid-1', site_id: SITE.id, action: 'register', canonical_base: 'https://midori-dental.jp', article_path: '/articles/{slug}' });
  assert.ok(!h.logs.join('').includes('unit-test-secret'), 'ログに鍵を出さない');
});

test('冪等：changed:false でも成功。deactivate / retire は reason を付ける', async () => {
  const h = harness([OK({ changed: false }), OK(), OK()]);
  assert.equal((await syncPublicationTarget(SITE, 'register', { event: 'x', ownerSeo: true }, h.deps) as { changed: boolean }).changed, false);
  await syncPublicationTarget(SITE, 'deactivate', { event: 'x', ownerSeo: true, reason: 'site_unpublished' }, h.deps);
  await syncPublicationTarget(SITE, 'retire', { event: 'x', ownerSeo: true, reason: 'site_deleted' }, h.deps);
  assert.deepEqual(h.calls[1].body, { public_id: 'pid-1', site_id: SITE.id, action: 'deactivate', reason: 'site_unpublished' });
  assert.deepEqual(h.calls[2].body, { public_id: 'pid-1', site_id: SITE.id, action: 'retire', reason: 'site_deleted' });
});

test('呼ばない：public_id なし・運営テストサイト・契約に LARU SEO なし・設定で切っている・鍵なし', async () => {
  const h = harness([OK()]);
  assert.equal((await syncPublicationTarget({ ...SITE, settings_json: {} }, 'register', { event: 'x', ownerSeo: true }, h.deps) as { reason: string }).reason, 'no_public_id');
  const test1 = { ...SITE, settings_json: { laruseoPublicId: [...PT_EXCLUDED_PUBLIC_IDS][0] } };
  assert.equal((await syncPublicationTarget(test1, 'register', { event: 'x', ownerSeo: true }, h.deps) as { reason: string }).reason, 'excluded');
  assert.equal((await syncPublicationTarget({ ...SITE, id: [...PT_EXCLUDED_SITE_IDS][0] }, 'register', { event: 'x', ownerSeo: true }, h.deps) as { reason: string }).reason, 'excluded');
  assert.equal((await syncPublicationTarget(SITE, 'register', { event: 'x', ownerSeo: false }, h.deps) as { reason: string }).reason, 'not_entitled');
  assert.equal(ptEligibility({ ...SITE, settings_json: { laruseoPublicId: 'pid-1', laruseo: false } }, true)?.reason, 'not_entitled');
  const saved = process.env.LARU_HP_API_SECRET;
  delete process.env.LARU_HP_API_SECRET;
  const nc = await syncPublicationTarget(SITE, 'deactivate', { event: 'x', ownerSeo: true, reason: 'site_unpublished' }, h.deps);
  process.env.LARU_HP_API_SECRET = saved;
  assert.equal((nc as { reason: string }).reason, 'not_configured');
  assert.equal(nc.safeForRemoval, true, '鍵の無い HP からは登録できない＝301 は作られていない');
  assert.equal(h.calls.length, 0);
});

test('401：再試行しない・消してよいとは言わない（保留）', async () => {
  const h = harness([{ status: 401, body: {} }]);
  const r = await syncPublicationTarget(SITE, 'deactivate', { event: 'x', ownerSeo: true, reason: 'site_unpublished' }, h.deps);
  assert.equal(r.kind, 'failed');
  assert.equal(h.calls.length, 1);
  assert.equal(r.safeForRemoval, false);
  assert.equal((r as { retryable: boolean }).retryable, false);
});

test('409 site_in_use：再試行しない。deactivate なら 301 は来ていないので消してよい。register では成功扱いにしない', async () => {
  const h = harness([{ status: 409, body: { error: 'site_in_use' } }]);
  const d = await syncPublicationTarget(SITE, 'deactivate', { event: 'x', ownerSeo: true, reason: 'site_unpublished' }, h.deps);
  assert.equal(d.kind, 'failed');
  assert.equal((d as { code: string }).code, 'site_in_use');
  assert.equal(d.safeForRemoval, true);
  const h2 = harness([{ status: 409, body: { error: 'site_in_use' } }]);
  const r = await syncPublicationTarget(SITE, 'register', { event: 'x', ownerSeo: true }, h2.deps);
  assert.equal(r.kind, 'failed');
  assert.equal(h2.calls.length, 1);
  assert.match(h2.logs[0], /"code":"site_in_use"/);
});

test('5xx・タイムアウト：指数バックオフで 3 回まで再試行（無限にしない）', async () => {
  const h = harness([{ status: 503 }, { status: 502 }, 'throw', { status: 500 }, OK()]);
  const r = await syncPublicationTarget(SITE, 'deactivate', { event: 'x', ownerSeo: true, reason: 'site_unpublished' }, h.deps);
  assert.equal(r.kind, 'failed');
  assert.equal(h.calls.length, 4, '最初の1回＋再試行3回');
  assert.deepEqual(h.sleeps, [300, 900, 2700]);
  assert.equal(r.safeForRemoval, false);
  assert.equal((r as { retryable: boolean }).retryable, true);
  const h2 = harness([{ status: 503 }, OK()]);
  const r2 = await syncPublicationTarget(SITE, 'register', { event: 'x', ownerSeo: true }, h2.deps);
  assert.equal(r2.kind, 'done');
  assert.equal((r2 as { attempts: number }).attempts, 2);
  // 記録：event・site_id・public_id・action・status・retryable・最終状態
  const last = JSON.parse(h.logs[h.logs.length - 1]);
  for (const k of ['event', 'site_id', 'public_id', 'action', 'status', 'retryable', 'final']) assert.ok(k in last, k);
});

test('register は記事一覧が 200 になってから（順番）。準備できていなければ呼ばない', async () => {
  const h = harness([OK()]);
  const r = await registerWhenReady(SITE, { event: 'site_published', ownerSeo: true }, h.deps);
  assert.equal(r.kind, 'done');
  assert.equal(h.calls[0].url, 'https://midori-dental.jp/articles', '先に記事一覧を確かめる');
  assert.equal(h.calls[1].body?.action, 'register');
  const h2 = harness([OK()], { articles: 404 });
  const r2 = await registerWhenReady(SITE, { event: 'site_published', ownerSeo: true }, h2.deps);
  assert.equal((r2 as { reason: string }).reason, 'not_ready');
  assert.equal(h2.calls.filter((c) => c.body).length, 0, '404 の段階では register しない');
  const h3 = harness([OK()], { articles: 503 });
  assert.equal((await registerWhenReady(SITE, { event: 'x', ownerSeo: true }, h3.deps)).kind, 'skipped');
});

test('LARU SEO の有無は既存のプラン判定（laruEntitlement）をそのまま使う', () => {
  assert.equal(seoActive({ plan: 'hp-bot-seo', status: 'active' }), true);
  assert.equal(seoActive({ plan: 'hp-bot-seo', status: 'past_due' }), false);
  assert.equal(seoActive({ plan: 'hp', status: 'active' }), false);
});

test('順番（ソース）：公開は DB 更新のあと・非公開/削除/解約/ダウングレード/主ドメイン解除は消す前', () => {
  const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
  const pub = src('app/api/sites/[id]/publish/route.ts');
  assert.ok(pub.indexOf('.update({ published: true, published_html: html })') < pub.indexOf('registerWhenReady('), '公開を終えてから register');
  const del = pub.slice(pub.indexOf('export async function DELETE'));
  assert.ok(del.indexOf("syncPublicationTarget(owned, 'deactivate'") < del.indexOf('.update({ published: false, published_html: null })'), '非公開の前に deactivate');
  assert.match(del, /if \(!stopped\.safeForRemoval\)[\s\S]*status: 503/);
  const site = src('app/api/sites/[id]/route.ts');
  const sd = site.slice(site.indexOf('export async function DELETE'));
  assert.ok(sd.indexOf("'retire'") < sd.indexOf('.delete()'), '削除の前に retire');
  const wh = src('app/api/stripe/webhook/route.ts');
  const dl = wh.slice(wh.indexOf("case 'customer.subscription.deleted'"));
  assert.ok(dl.indexOf('beforeCancel(') < dl.indexOf('unpublishSitesOfUser('), '解約で非公開にする前に retire');
  const up = wh.slice(wh.indexOf("case 'customer.subscription.updated'"));
  assert.ok(up.indexOf('beforeBillingChange(') < up.indexOf(".from('profiles').update(updates)"), 'プランを書き込む前に deactivate');
  const pf = wh.slice(wh.indexOf("case 'invoice.payment_failed'"));
  assert.ok(pf.indexOf('beforeBillingChange(') < pf.indexOf(".update({ subscription_status: 'past_due' })"));
  const upg = src('app/api/stripe/upgrade/route.ts');
  assert.ok(upg.indexOf('beforeBillingChange(') < upg.indexOf('stripe.subscriptions.update('), 'Stripe に触る前に deactivate');
  const dom = src('app/api/sites/[id]/domain/route.ts');
  assert.ok(dom.indexOf('beforePrimaryDomainRelease(') < dom.indexOf('releaseDomain(deps'), '主ドメインを外す前に base を移す');
  const cron = src('app/api/cron/subscription-sync/route.ts');
  assert.ok(cron.indexOf("beforeCancel(db, profile.id, profile.plan, 'subscription_sync_canceled')") < cron.indexOf('const unpublished = await unpublishSitesOfUser(db, profile.id);'));
});

test('HP 側に記事生成・枠・プラン・Stripe の変更を持たない（呼ぶだけ）', () => {
  const s = readFileSync(new URL('../lib/publication-target-sync.ts', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
  assert.ok(!/stripe|quota|price|generate/i.test(s));
});
