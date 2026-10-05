import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  postEntitlement, entitlementChange, entitlementPlan, nextRecord, syncSiteEntitlement, syncUserEntitlement,
  retryPendingEntitlements, entitlementBeforeSiteDelete, RETRY_DELAYS_MS, ENT_KEY, type EntRecord,
} from '../lib/hp-entitlement-sync';
import { afterBillingChange, beforeCancel, reactivateWhenReady } from '../lib/publication-target-sync';

process.env.LARU_HP_API_SECRET = 'unit-test-secret';
process.env.LARUBOT_API_URL = 'https://laru.test';
delete process.env.HP_ARTICLES_READY_ORIGIN;
delete process.env.RESEND_API_KEY;

const USER = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const SITE_ID = '11111111-1111-4111-8111-111111111111';
const T1 = '2026-10-05T01:00:00.000Z', T2 = '2026-10-05T02:00:00.000Z';
type Reply = { status: number; body?: unknown } | 'throw';
type Call = { url: string; body: Record<string, unknown> | null; headers: Headers };

/** LARUbot の代わり（/api/hp/entitlement・publication-target・記事一覧） */
function harness(ent: Reply[], pt: Reply[] = [{ status: 200, body: { ok: true, changed: true, registration: { state: 'active' } } }], articles = 200) {
  const calls: Call[] = [], logs: string[] = [], sleeps: number[] = [];
  let ei = 0, pi = 0;
  const reply = (r: Reply) => { if (r === 'throw') throw new Error('network'); return new Response(JSON.stringify(r.body ?? {}), { status: r.status, headers: { 'content-type': 'application/json' } }); };
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null, headers: new Headers(init?.headers) });
    if (url.endsWith('/articles')) return new Response('', { status: articles });
    if (url.endsWith('/api/hp/entitlement')) return reply(ent[Math.min(ei++, ent.length - 1)]);
    return reply(pt[Math.min(pi++, pt.length - 1)]);
  }) as typeof fetch;
  return { calls, logs, sleeps, deps: { fetch: fetchImpl, sleep: async (ms: number) => { sleeps.push(ms); }, log: (_l: string, line: Record<string, unknown>) => { logs.push(JSON.stringify(line)); } } };
}
const APPLIED = { status: 200, body: { ok: true, applied: true, reason: 'applied', entitlement: { plan: 'starter', bot: true, seo: true } } };

/** 偽の DB（sites・profiles）。settings_json->key->>status の絞り込みも本物と同じ意味で */
function fakeDb(sites: Array<Record<string, unknown>>, profile = { plan: 'hp-bot-seo', subscription_status: 'active' }) {
  const pick = (row: Record<string, unknown>, k: string) => {
    if (!k.includes('->')) return row[k];
    const [col, ...path] = k.split(/->>?/);
    return path.reduce<unknown>((v, p) => (v && typeof v === 'object' ? (v as Record<string, unknown>)[p] : undefined), row[col]);
  };
  return {
    sites,
    from(t: string) {
      const rows = t === 'sites' ? sites : [{ id: USER, ...profile }];
      return {
        select() {
          const filters: Array<[string, string]> = [];
          const run = () => Promise.resolve({ data: rows.filter((r) => filters.every(([k, v]) => String(pick(r, k)) === v)).map((r) => JSON.parse(JSON.stringify(r))), error: null });
          const q = {
            eq(k: string, v: string) { filters.push([k, v]); return q; },
            limit() { return run(); },
            maybeSingle() { return run().then((r) => ({ data: r.data[0] ?? null, error: null })); },
            then(res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) { return run().then(res, rej); },
          };
          return q;
        },
        update(v: Record<string, unknown>) {
          return { eq(k: string, id: string) { return { select() { const hit = rows.filter((r) => r[k] === id); hit.forEach((r) => Object.assign(r, JSON.parse(JSON.stringify(v)))); return Promise.resolve({ data: hit.map((r) => ({ id: r.id })), error: null }); } }; } };
        },
      };
    },
  };
}
const site = (extra: Record<string, unknown> = {}) => ({ id: SITE_ID, user_id: USER, slug: 'midori', custom_domain: null, published: true, settings_json: { larubotPublicId: 'pid-1', laruseoPublicId: 'pid-1', laruseo: true, ...extra } });
const record = (s: Record<string, unknown>) => (s.settings_json as Record<string, unknown>)[ENT_KEY] as EntRecord;

test('送る中身：仕様の口・register と同じ鍵ヘッダー・public_id/site_id/user_id/plan/state/event_at。ログに鍵を出さない', async () => {
  const h = harness([APPLIED]);
  const r = await postEntitlement({ publicId: 'pid-1', siteId: SITE_ID, userId: USER, plan: 'hp-bot-seo', state: 'active', eventAt: T1, event: 'x' }, h.deps);
  assert.equal(r.kind, 'done');
  assert.equal(h.calls[0].url, 'https://laru.test/api/hp/entitlement');
  assert.equal(h.calls[0].headers.get('x-laru-secret'), 'unit-test-secret');
  assert.deepEqual(h.calls[0].body, { public_id: 'pid-1', site_id: SITE_ID, user_id: USER, plan: 'hp-bot-seo', state: 'active', event_at: T1 });
  assert.ok(!h.logs.join('').includes('unit-test-secret'));
});

test('duplicate / stale は正常応答（再送しない・失敗にしない）', async () => {
  for (const reason of ['duplicate', 'stale']) {
    const h = harness([{ status: 200, body: { ok: true, applied: false, reason } }]);
    const r = await postEntitlement({ publicId: 'p', siteId: SITE_ID, userId: USER, plan: 'hp', state: 'active', eventAt: T1, event: 'x' }, h.deps);
    assert.deepEqual([r.kind, (r as { result: string }).result, h.calls.length], ['done', reason, 1]);
  }
});

test('4xx は再送しない（1 回）。5xx・通信エラーだけ指数バックオフで 3 回まで', async () => {
  for (const status of [400, 401, 404, 409]) {
    const h = harness([{ status, body: { code: 'site_mismatch' } }]);
    const r = await postEntitlement({ publicId: 'p', siteId: SITE_ID, userId: USER, plan: 'hp', state: 'active', eventAt: T1, event: 'x' }, h.deps);
    assert.deepEqual([r.kind, (r as { retryable: boolean }).retryable, h.calls.length], ['failed', false, 1], String(status));
  }
  const h = harness([{ status: 503 }, 'throw', { status: 502 }, { status: 500 }]);
  const r = await postEntitlement({ publicId: 'p', siteId: SITE_ID, userId: USER, plan: 'hp', state: 'active', eventAt: T1, event: 'x' }, h.deps);
  assert.deepEqual([r.kind, (r as { retryable: boolean }).retryable, h.calls.length, h.sleeps], ['failed', true, 4, [300, 900, 2700]]);
});

test('plan：HP のプラン ID をそのまま送る。Bot Lite（lite）と Standard（hp-bot）は別の値。知らない値は送らない', () => {
  assert.deepEqual(['hp', 'lite', 'hp-bot', 'hp-bot-seo', 'agency'].map(entitlementPlan), ['hp', 'lite', 'hp-bot', 'hp-bot-seo', 'agency']);
  assert.notEqual(entitlementPlan('lite'), entitlementPlan('hp-bot'));
  assert.deepEqual([null, '', 'starter', 'pro', 'laru-cloud', 'toString'].map(entitlementPlan), [null, null, null, null, null, null]);
});

test('いつ送るか：新規・再契約・上げ下げは送る。解約予約・支払い遅延・回復・同じプランは送らない（権利を止めない）', () => {
  const A = (plan: string | null, status: string | null) => ({ plan, status });
  assert.deepEqual(entitlementChange(A(null, null), A('hp-bot', 'active')), { plan: 'hp-bot', state: 'active' });          // 新規
  assert.deepEqual(entitlementChange(A(null, 'canceled'), A('hp-bot-seo', 'active')), { plan: 'hp-bot-seo', state: 'active' }); // 再契約
  assert.deepEqual(entitlementChange(A('hp-bot', 'active'), A('hp-bot-seo', 'active')), { plan: 'hp-bot-seo', state: 'active' }); // 上げ
  assert.deepEqual(entitlementChange(A('hp-bot-seo', 'active'), A('lite', 'active')), { plan: 'lite', state: 'active' });      // 下げ
  assert.deepEqual(entitlementChange(A('hp-bot', 'active'), A('hp', 'active')), { plan: 'hp', state: 'active' });              // Bot を外す
  assert.equal(entitlementChange(A('hp-bot', 'active'), A('hp-bot', 'active')), null);       // 解約予約（期間中は同じ）
  assert.equal(entitlementChange(A('hp-bot', 'active'), A('hp-bot', 'past_due')), null);     // 支払い遅延
  assert.equal(entitlementChange(A('hp-bot', 'past_due'), A('hp-bot', 'active')), null);     // 回復
  assert.equal(entitlementChange(A('hp-bot', 'active'), A('hp-bot', 'canceled')), null);     // 解約は beforeCancel で（実際に終わったとき）
  assert.equal(entitlementChange(A('hp', 'active'), A('mystery', 'active')), null);
});

test('再送の控え：event_at は再送でも同じ。1分→5分→30分…、24 時間届かなければあきらめて運営へ', () => {
  const now = new Date(T2);
  const input = { plan: 'hp-bot', state: 'active' as const, eventAt: T1, userId: USER, event: 'x' };
  const fail = { kind: 'failed' as const, status: 503, code: null, retryable: true, attempts: 4 };
  const r1 = nextRecord(null, input, fail, now);
  assert.deepEqual([r1.status, r1.event_at, r1.attempts, Date.parse(r1.next_at!) - now.getTime()], ['pending', T1, 1, RETRY_DELAYS_MS[0]]);
  const r2 = nextRecord(r1, input, fail, now);
  assert.deepEqual([r2.attempts, Date.parse(r2.next_at!) - now.getTime(), r2.first_failed_at], [2, RETRY_DELAYS_MS[1], r1.first_failed_at]);
  const late = nextRecord(r2, input, fail, new Date(Date.parse(r1.first_failed_at!) + 24 * 3600_000));
  assert.deepEqual([late.status, late.next_at], ['failed', null]);
  const four = nextRecord(null, input, { ...fail, status: 409, retryable: false }, now);
  assert.deepEqual([four.status, four.next_at], ['failed', null]);
});

test('サイトごとの同期：成功は synced。5xx は pending（次の時刻つき）。同じ内容は送り直さない。新しい控えを古い状態で上書きしない', async () => {
  const db = fakeDb([site()]);
  let h = harness([APPLIED]);
  await syncSiteEntitlement(db, db.sites[0] as never, { plan: 'hp-bot-seo', state: 'active', eventAt: T1, event: 'x' }, h.deps);
  assert.deepEqual([record(db.sites[0]).status, record(db.sites[0]).event_at, record(db.sites[0]).result], ['synced', T1, 'applied']);
  h = harness([APPLIED]);
  const again = await syncSiteEntitlement(db, db.sites[0] as never, { plan: 'hp-bot-seo', state: 'active', eventAt: T1, event: 'x' }, h.deps);
  assert.deepEqual([again.kind, h.calls.length], ['skipped', 0]);
  h = harness([{ status: 503 }]);
  await syncSiteEntitlement(db, db.sites[0] as never, { plan: 'hp-bot', state: 'active', eventAt: T2, event: 'down' }, h.deps);
  assert.deepEqual([record(db.sites[0]).status, record(db.sites[0]).event_at, !!record(db.sites[0]).next_at], ['pending', T2, true]);
  h = harness([APPLIED]);
  const older = await syncSiteEntitlement(db, db.sites[0] as never, { plan: 'hp-bot-seo', state: 'active', eventAt: T1, event: 'late' }, h.deps);
  assert.deepEqual([older.kind, h.calls.length, record(db.sites[0]).event_at], ['skipped', 0, T2], '順序の逆転：古いイベントは送らない・控えも戻さない');
  // 直接契約・public_id・記事の設定は触らない
  assert.equal((db.sites[0].settings_json as Record<string, unknown>).larubotPublicId, 'pid-1');
});

test('再送：時刻を過ぎた pending だけ、控えた event_at のまま。成功したら（SEO 再追加なら）そのあと公開先を reactivate', async () => {
  const pending: EntRecord = { plan: 'hp-bot-seo', state: 'active', event_at: T1, user_id: USER, event: 'readd', status: 'pending', attempts: 1, first_failed_at: T1, next_at: T1, last_http: 503, last_code: null, result: null, reactivate_pt: true };
  const db = fakeDb([site({ [ENT_KEY]: pending }), { ...site({ [ENT_KEY]: { ...pending, next_at: '2999-01-01T00:00:00.000Z' } }), id: '22222222-2222-4222-8222-222222222222', settings_json: { larubotPublicId: 'pid-2', [ENT_KEY]: { ...pending, next_at: '2999-01-01T00:00:00.000Z' } } }]);
  const h = harness([APPLIED]);
  const c = await retryPendingEntitlements(db, { ...h.deps, now: () => new Date(T2) });
  assert.deepEqual(c, { due: 1, done: 1, pending: 0, failed: 0 });
  const ent = h.calls.filter((x) => x.url.endsWith('/api/hp/entitlement'));
  assert.deepEqual([ent.length, ent[0].body?.event_at, ent[0].body?.public_id], [1, T1, 'pid-1']);
  const order = h.calls.map((x) => (x.url.endsWith('/entitlement') ? 'entitlement' : x.url.endsWith('/articles') ? 'articles' : String(x.body?.action)));
  assert.deepEqual(order, ['entitlement', 'articles', 'reactivate']);
  assert.equal(record(db.sites[0]).status, 'synced');
});

test('SEO の再追加：entitlement が成功してから reactivate（いまの canonical_base）。entitlement が再送待ちなら reactivate しない', async () => {
  let db = fakeDb([site()]);
  let h = harness([APPLIED]);
  await afterBillingChange(db, USER, { plan: 'hp-bot', status: 'active' }, { plan: 'hp-bot-seo', status: 'active' }, 'upgrade', { ...h.deps, eventAt: T1 });
  const order = h.calls.map((x) => (x.url.endsWith('/entitlement') ? 'entitlement' : x.url.endsWith('/articles') ? 'articles' : String(x.body?.action)));
  assert.deepEqual(order, ['entitlement', 'articles', 'reactivate']);
  assert.equal(h.calls[2].body?.canonical_base, 'https://laruvisona.jp/hp/midori');
  db = fakeDb([site()]);
  h = harness([{ status: 503 }]);
  await afterBillingChange(db, USER, { plan: 'hp-bot', status: 'active' }, { plan: 'hp-bot-seo', status: 'active' }, 'upgrade', { ...h.deps, eventAt: T1 });
  assert.ok(!h.calls.some((x) => x.body?.action === 'reactivate'));
  assert.deepEqual([record(db.sites[0]).status, record(db.sites[0]).reactivate_pt], ['pending', true]);
  // 時刻が無い呼び出しでは送らない（作らない）
  h = harness([APPLIED]);
  await afterBillingChange(fakeDb([site()]), USER, { plan: 'hp-bot', status: 'active' }, { plan: 'lite', status: 'active' }, 'x', h.deps);
  assert.equal(h.calls.filter((x) => x.url.endsWith('/entitlement')).length, 0);
});

test('reactivate：未登録（409 not_registered）なら register で作る', async () => {
  const h = harness([APPLIED], [{ status: 409, body: { code: 'not_registered' } }, { status: 200, body: { ok: true, registration: { state: 'active' } } }]);
  const r = await reactivateWhenReady(site() as never, { event: 'x', ownerSeo: true }, h.deps);
  assert.equal(r.kind, 'done');
  assert.deepEqual(h.calls.filter((x) => x.body?.action).map((x) => x.body?.action), ['reactivate', 'register']);
});

test('解約：公開先を retire してから cancelled（plan は最後のもの）。Bot だけのプランでも送る。公開先を止められなければ送らない（保留）', async () => {
  let h = harness([APPLIED], [{ status: 200, body: { ok: true, registration: { state: 'retired' } } }]);
  assert.equal(await beforeCancel(fakeDb([site()]), USER, 'hp-bot-seo', 'cancel', { ...h.deps, eventAt: T1 }), true);
  const order = h.calls.map((x) => (x.url.endsWith('/entitlement') ? `entitlement:${x.body?.state}` : String(x.body?.action)));
  assert.deepEqual(order, ['retire', 'entitlement:cancelled']);
  assert.equal(h.calls[1].body?.plan, 'hp-bot-seo');
  h = harness([APPLIED]);
  await beforeCancel(fakeDb([site()]), USER, 'lite', 'cancel', { ...h.deps, eventAt: T1 });
  assert.deepEqual(h.calls.map((x) => x.body?.state), ['cancelled']);
  h = harness([APPLIED], [{ status: 503 }]);
  assert.equal(await beforeCancel(fakeDb([site()]), USER, 'hp-bot-seo', 'cancel', { ...h.deps, eventAt: T1 }), false);
  assert.ok(!h.calls.some((x) => x.url.endsWith('/entitlement')));
  // entitlement が届かなくても解約は止めない（再送待ち）
  const db = fakeDb([site()]);
  h = harness([{ status: 503 }]);
  assert.equal(await beforeCancel(db, USER, 'lite', 'cancel', { ...h.deps, eventAt: T1 }), true);
  assert.equal(record(db.sites[0]).status, 'pending');
});

test('サイト削除：site_deleted をその場で送る。5xx・通信エラーなら削除を保留、4xx は運営へ知らせて進める', async () => {
  let h = harness([APPLIED]);
  assert.equal(await entitlementBeforeSiteDelete(fakeDb([]), site() as never, 'hp-bot', h.deps), true);
  assert.deepEqual([h.calls[0].body?.state, h.calls[0].body?.plan, h.calls[0].body?.site_id], ['site_deleted', 'hp-bot', SITE_ID]);
  h = harness([{ status: 503 }]);
  assert.equal(await entitlementBeforeSiteDelete(fakeDb([]), site() as never, 'hp-bot', h.deps), false);
  h = harness([{ status: 409, body: { code: 'site_mismatch' } }]);
  assert.equal(await entitlementBeforeSiteDelete(fakeDb([]), site() as never, null, h.deps), true);
  h = harness([APPLIED]);
  assert.equal(await entitlementBeforeSiteDelete(fakeDb([]), { ...site(), settings_json: {} } as never, 'hp', h.deps), true);
  assert.equal(h.calls.length, 0, 'LARUbot に紐付いていないサイトは送らない');
});

test('持ち主の会社ごとに 1 回（同じ public_id のサイトが複数あっても二重に送らない）', async () => {
  const db = fakeDb([site(), { ...site(), id: '33333333-3333-4333-8333-333333333333' }]);
  const h = harness([APPLIED]);
  await syncUserEntitlement(db, USER, { plan: 'hp-bot', state: 'active', eventAt: T1, event: 'x' }, h.deps);
  assert.equal(h.calls.length, 1);
});

test('つなぎ込み（ソース）：event_at の出どころ・register にも event_at・順序・決済を止めない', () => {
  const read = (p: string) => readFileSync(p, 'utf8');
  const wh = read('app/api/stripe/webhook/route.ts');
  assert.match(wh, /checkoutEventAt = new Date\(event\.created \* 1000\)/);
  assert.match(wh, /provisionLarubotOnPlan\(\{ userId, email: adminCheck\?\.email, plan: plan \|\| 'hp', siteId, eventAt: checkoutEventAt \}\)/);
  assert.ok(wh.indexOf('provisionLarubotOnPlan({ userId, email') < wh.indexOf("'stripe_checkout_completed'"), 'register → entitlement');
  assert.match(wh, /ended_at \?\? event\.created/);
  assert.match(read('lib/larubot-provision.ts'), /\.\.\.\(eventAt \? \{ event_at: eventAt \} : \{\}\)/);
  for (const p of ['app/api/stripe/upgrade/route.ts', 'app/api/admin/users/[id]/route.ts', 'app/api/stripe/checkout/route.ts']) {
    const s = read(p);
    assert.ok(s.indexOf('planEventAt = new Date().toISOString()') > s.indexOf('stripe.subscriptions.update'), `${p}: 時刻は Stripe の変更が確定したあと`);
    assert.match(s, /eventAt: planEventAt/);
  }
  const del = read('app/api/sites/[id]/route.ts');
  assert.ok(del.indexOf('entitlementBeforeSiteDelete(') < del.indexOf('.delete()'));
  const cron = read('app/api/cron/subscription-sync/route.ts');
  assert.match(cron, /beforeCancel\(db, profile\.id, profile\.plan, 'subscription_sync_canceled', \{ eventAt:/);
  assert.match(read('server.js'), /\/api\/cron\/hp-entitlement-retry/);
  const lib = read('lib/hp-entitlement-sync.ts');
  assert.ok(!/stripe\.|price_|quota|generate/i.test(lib.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')), '権利の同期は Stripe・料金・枠・記事に触らない');
  assert.match(read('lib/laru-entitlement.ts'), /'larubotEntitlement'\] as const/);
  assert.match(read('app/api/sites/[id]/versions/[versionId]/route.ts'), /keepServerOwnedSettings\(site\.settings_json/);
});
