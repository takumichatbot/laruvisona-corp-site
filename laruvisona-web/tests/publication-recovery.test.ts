import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  seoConfirmed, retryPendingEntitlements, retryPendingRecoveries, ENT_KEY, RECOVERY_KEY,
  type EntRecord, type RecoveryRecord, type EntOutcome,
} from '../lib/hp-entitlement-sync';
import { afterBillingChange } from '../lib/publication-target-sync';
import { alertIdempotencyKey, alertMessage, alertLarubotFailure } from '../lib/larubot-alert';

/**
 * 公開先の自動復帰（記事一覧が一時的に 200 でなかったとき）と、SEO を確かめられない応答の扱い、通知の重複（2026-10-18）。
 */
process.env.LARU_HP_API_SECRET = 'unit-test-secret';
process.env.LARUBOT_API_URL = 'https://laru.test';
delete process.env.HP_ARTICLES_READY_ORIGIN;
delete process.env.RESEND_API_KEY;

const USER = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const SITE_ID = '11111111-1111-4111-8111-111111111111';
const T1 = '2026-10-05T01:00:00.000Z';
type Reply = { status: number; body?: unknown } | 'throw' | 'badjson';

/** LARUbot と記事一覧の代わり。記事一覧の状態は途中で変えられる */
function world(ent: Reply[] = [{ status: 200, body: { ok: true, applied: true, reason: 'applied', entitlement: { plan: 'starter', bot: true, seo: true } } }]) {
  const state = { articles: 200 as number, status: { status: 404, body: {} } as Reply, onPt: null as null | ((body: Record<string, unknown>) => void), pt: [{ status: 200, body: { ok: true, changed: true, registration: { state: 'active' } } }] as Reply[], calls: [] as { url: string; body: Record<string, unknown> | null }[] };
  let ei = 0, pi = 0;
  const reply = (r: Reply) => {
    if (r === 'throw') throw new Error('network');
    if (r === 'badjson') return new Response('<html>oops', { status: 200 });
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status, headers: { 'content-type': 'application/json' } });
  };
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    state.calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
    if (url.endsWith('/articles')) return new Response('', { status: state.articles });
    if (url.endsWith('/api/hp/entitlement')) return reply(ent[Math.min(ei++, ent.length - 1)]);
    if (url.includes('/api/hp/status')) return reply(state.status);
    if (state.onPt && init?.body) state.onPt(JSON.parse(String(init.body)));
    return reply(state.pt[Math.min(pi++, state.pt.length - 1)]);
  }) as typeof fetch;
  let clock = Date.parse('2026-10-18T00:00:00.000Z');
  const deps = { fetch: fetchImpl, sleep: async () => {}, log: () => {}, now: () => new Date(clock) };
  const tick = (ms: number) => { clock += ms; };
  const actions = () => state.calls.filter((c) => c.body?.action).map((c) => String(c.body!.action));
  const entCalls = () => state.calls.filter((c) => c.url.endsWith('/api/hp/entitlement')).length;
  return { state, deps, tick, actions, entCalls };
}

/** 偽 DB（sites・profiles）。settings_json->a->>b の絞り込み・updated_at の確かめも本物と同じ意味で */
function fakeDb(sites: Array<Record<string, unknown>>, profile: Record<string, unknown> = { plan: 'hp-bot-seo', subscription_status: 'active' }) {
  let clock = 0;
  const pick = (row: Record<string, unknown>, k: string) => {
    if (!k.includes('->')) return row[k];
    const [col, ...path] = k.split(/->>?/);
    return path.reduce<unknown>((v, p) => (v && typeof v === 'object' ? (v as Record<string, unknown>)[p] : undefined), row[col]);
  };
  const hooks: { beforeUpdate?: (rows: Array<Record<string, unknown>>) => void; failUpdates?: boolean; failProfile?: boolean } = {};
  return {
    sites, hooks, profile,
    from(t: string) {
      const rows = t === 'sites' ? sites : [{ id: USER, ...profile }];
      return {
        select() {
          const filters: Array<[string, string]> = [];
          const run = () => t !== 'sites' && hooks.failProfile ? Promise.resolve({ data: null, error: { message: 'down' } }) : Promise.resolve({ data: rows.filter((r) => filters.every(([k, v]) => String(pick(r, k)) === v)).map((r) => JSON.parse(JSON.stringify(r))), error: null });
          const q = {
            eq(k: string, v: string) { filters.push([k, v]); return q; },
            limit() { return run(); },
            maybeSingle() { return run().then((r) => ({ data: r.data?.[0] ?? null, error: r.error })); },
            then(res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) { return run().then(res, rej); },
          };
          return q;
        },
        update(v: Record<string, unknown>) {
          const conds: Array<[string, string]> = [];
          const q = {
            eq(k: string, val: string) { conds.push([k, val]); return q; },
            select() {
              if (hooks.failUpdates) return Promise.resolve({ data: null, error: { message: 'down' } });
              if (hooks.beforeUpdate) hooks.beforeUpdate(rows);
              const hit = rows.filter((r) => conds.every(([k, val]) => String(r[k]) === String(val)));
              hit.forEach((r) => { Object.assign(r, JSON.parse(JSON.stringify(v))); r.updated_at = `t${++clock}`; });
              return Promise.resolve({ data: hit.map((r) => ({ id: r.id })), error: null });
            },
          };
          return q;
        },
      };
    },
  };
}
const site = (extra: Record<string, unknown> = {}, over: Record<string, unknown> = {}) => ({ id: SITE_ID, user_id: USER, slug: 'midori', custom_domain: null, published: true, updated_at: 't0', settings_json: { larubotPublicId: 'pid-1', laruseoPublicId: 'pid-1', laruseo: true, ...extra }, ...over });
const rec = (s: Record<string, unknown>) => (s.settings_json as Record<string, unknown>)[RECOVERY_KEY] as RecoveryRecord | undefined;
const ent = (s: Record<string, unknown>) => (s.settings_json as Record<string, unknown>)[ENT_KEY] as EntRecord | undefined;
const UPGRADE = [{ plan: 'hp-bot', status: 'active' }, { plan: 'hp-bot-seo', status: 'active' }] as const;

test('1・3：権利同期の成功 → 記事一覧 503 → 次の定期処理で 200 → 公開先が戻る（本人の操作なし・権利 API は再送しない）', async () => {
  const w = world();
  const db = fakeDb([site()]);
  w.state.articles = 503;
  await afterBillingChange(db, USER, UPGRADE[0], UPGRADE[1], 'upgrade', { ...w.deps, eventAt: T1 });
  assert.equal(ent(db.sites[0])?.status, 'synced', '権利は同期済みのまま');
  assert.equal(rec(db.sites[0])?.state, 'pending', '公開先の復帰待ちが残っていない');
  assert.equal(rec(db.sites[0])?.event_at, T1);
  assert.deepEqual(w.actions(), [], '記事一覧が 503 なのに公開先を呼んだ');
  const entBefore = w.entCalls();
  // 時刻前は何もしない
  let c = await retryPendingRecoveries(db, w.deps);
  assert.equal(c.due, 0);
  w.tick(61_000);
  w.state.articles = 200;
  c = await retryPendingRecoveries(db, w.deps);
  assert.deepEqual(w.actions(), ['reactivate']);
  assert.equal(rec(db.sites[0])?.state, 'done');
  assert.equal(rec(db.sites[0])?.event_at, T1, 'event_at を現在時刻へ更新した');
  assert.equal(w.entCalls(), entBefore, '公開先のために権利 API を再送した');
  // もう一度回しても、何もしない（重複しない）
  w.tick(10 * 60_000);
  await retryPendingRecoveries(db, w.deps);
  assert.deepEqual(w.actions(), ['reactivate']);
});

test('2：記事一覧 404（反映待ち）は 24 時間まで再試行し、回復したら戻る。期限を過ぎたら要対応（event_at・起点は固定）', async () => {
  const w = world();
  const db = fakeDb([site()]);
  w.state.articles = 404;
  await afterBillingChange(db, USER, UPGRADE[0], UPGRADE[1], 'upgrade', { ...w.deps, eventAt: T1 });
  const first = rec(db.sites[0])!;
  for (let i = 0; i < 3; i++) { w.tick(31 * 60_000); await retryPendingRecoveries(db, w.deps); }
  const mid = rec(db.sites[0])!;
  assert.equal(mid.state, 'pending');
  assert.equal(mid.first_at, first.first_at, '起点を毎回リセットした');
  assert.ok(mid.attempts >= 2);
  w.state.articles = 200; w.tick(3 * 3600_000);
  await retryPendingRecoveries(db, w.deps);
  assert.equal(rec(db.sites[0])?.state, 'done');
  // 回復しないまま 24 時間 → 要対応（無限に再試行しない）
  const w2 = world(); const db2 = fakeDb([site()]); w2.state.articles = 404;
  await afterBillingChange(db2, USER, UPGRADE[0], UPGRADE[1], 'upgrade', { ...w2.deps, eventAt: T1 });
  for (let i = 0; i < 40; i++) { w2.tick(3600_000); await retryPendingRecoveries(db2, w2.deps); }
  assert.equal(rec(db2.sites[0])?.state, 'needs_attention');
  assert.deepEqual(w2.actions(), []);
});

test('2・5：意図した非公開・SEO 解除・解約・削除・紐付けの変更・運営テストサイトになったら、復帰待ちを中止（戻さない）', async () => {
  const cases: Array<[string, (db: ReturnType<typeof fakeDb>) => void]> = [
    ['非公開', (db) => { db.sites[0].published = false; }],
    ['SEO 解除（契約）', (db) => { db.profile.plan = 'hp-bot'; }],
    ['解約', (db) => { db.profile.subscription_status = 'canceled'; }],
    ['設定で SEO を切った', (db) => { (db.sites[0].settings_json as Record<string, unknown>).laruseo = false; }],
    ['紐付けの変更', (db) => { (db.sites[0].settings_json as Record<string, unknown>).larubotPublicId = 'pid-2'; (db.sites[0].settings_json as Record<string, unknown>).laruseoPublicId = 'pid-2'; }],
    ['新しい権利（解約）の控え', (db) => { (db.sites[0].settings_json as Record<string, unknown>)[ENT_KEY] = { plan: 'hp-bot-seo', state: 'cancelled', event_at: '2026-10-06T00:00:00.000Z', user_id: USER, event: 'cancel', status: 'synced', attempts: 0, first_failed_at: null, next_at: null, last_http: 200, last_code: null, result: 'applied' }; }],
    ['削除', (db) => { db.sites.splice(0, 1); }],
  ];
  for (const [name, change] of cases) {
    const w = world(); const db = fakeDb([site()]); w.state.articles = 503;
    await afterBillingChange(db, USER, UPGRADE[0], UPGRADE[1], 'upgrade', { ...w.deps, eventAt: T1 });
    change(db);
    w.state.articles = 200; w.tick(2 * 3600_000);
    await retryPendingRecoveries(db, w.deps);
    assert.deepEqual(w.actions(), [], `${name}：公開先を戻した`);
    if (db.sites[0]) assert.equal(rec(db.sites[0])?.state, 'cancelled', name);
  }
});

test('6：待っている間に独自ドメインが変わったら、新しい base で戻す（古い base へ戻さない）', async () => {
  const w = world(); const db = fakeDb([site()]); w.state.articles = 503;
  await afterBillingChange(db, USER, UPGRADE[0], UPGRADE[1], 'upgrade', { ...w.deps, eventAt: T1 });
  db.sites[0].custom_domain = 'midori-new.jp';
  w.state.articles = 200; w.tick(2 * 3600_000);
  await retryPendingRecoveries(db, w.deps);
  const call = w.state.calls.find((c) => c.body?.action === 'reactivate');
  assert.equal(call?.body?.canonical_base, 'https://midori-new.jp');
  assert.ok(w.state.calls.some((c) => c.url === 'https://midori-new.jp/articles'), '新しい base の記事一覧を確かめていない');
});

test('7・8：SEO を確かめられない応答では戻さない。applied / duplicate で seo:true のときだけ戻す', () => {
  const done = (result: string, entitlement: Record<string, unknown> | null): EntOutcome => ({ kind: 'done', result, entitlement, attempts: 1 });
  for (const [why, o] of [
    ['stale', done('stale', { seo: true })],
    ['未知の reason', done('accepted_later', { seo: true })],
    ['reason なし', done('unknown', { seo: true })],
    ['seo 欠落', done('applied', { plan: 'starter', bot: true })],
    ['seo null', done('applied', { seo: null })],
    ['seo false', done('applied', { seo: false })],
    ['seo が文字列', done('applied', { seo: 'true' })],
    ['entitlement なし', done('applied', null)],
    ['失敗', { kind: 'failed', status: 503, code: null, retryable: true, attempts: 4 } as EntOutcome],
  ] as const) assert.equal(seoConfirmed(o), false, why);
  assert.equal(seoConfirmed(done('applied', { seo: true })), true);
  assert.equal(seoConfirmed(done('duplicate', { seo: true })), true);
});

test('7：空 JSON・壊れた JSON・reason の無い 200 では戻さない（同期の記録は確認できなかったと残す）', async () => {
  for (const reply of [{ status: 200, body: {} }, 'badjson' as const, { status: 200, body: { ok: true, entitlement: { seo: true } } }]) {
    const w = world([reply]); const db = fakeDb([site()]);
    await afterBillingChange(db, USER, UPGRADE[0], UPGRADE[1], 'upgrade', { ...w.deps, eventAt: T1 });
    assert.deepEqual(w.actions(), [], JSON.stringify(reply));
    assert.notEqual(ent(db.sites[0])?.result, 'applied', '確かめていないのに applied と記録した');
    w.tick(2 * 3600_000);
    await retryPendingRecoveries(db, w.deps);
    assert.deepEqual(w.actions(), [], `${JSON.stringify(reply)}：あとから戻した`);
  }
});

test('7：時刻（eventAt）が無い・控えが確認済みでない支払い回復では戻さない。確認済みの控えがあれば戻す', async () => {
  let w = world(); let db = fakeDb([site()]);
  await afterBillingChange(db, USER, UPGRADE[0], UPGRADE[1], 'no_time', w.deps);
  assert.deepEqual(w.actions(), [], 'eventAt なしで戻した');
  // 同じプランのまま支払いが回復（権利は送らない経路）：控えが確認済みでなければ戻さない
  w = world(); db = fakeDb([site()]);
  await afterBillingChange(db, USER, { plan: 'hp-bot-seo', status: 'past_due' }, { plan: 'hp-bot-seo', status: 'active' }, 'recover', { ...w.deps, eventAt: T1 });
  assert.deepEqual(w.actions(), [], '確認済みの控えなしで戻した');
  const confirmed: EntRecord = { plan: 'hp-bot-seo', state: 'active', event_at: '2026-10-01T00:00:00.000Z', user_id: USER, event: 'up', status: 'synced', attempts: 0, first_failed_at: null, next_at: null, last_http: 200, last_code: null, result: 'applied' };
  w = world(); db = fakeDb([site({ [ENT_KEY]: confirmed })]);
  await afterBillingChange(db, USER, { plan: 'hp-bot-seo', status: 'past_due' }, { plan: 'hp-bot-seo', status: 'active' }, 'recover', { ...w.deps, eventAt: T1 });
  assert.deepEqual(w.actions(), ['reactivate']);
});

test('4：控えの再送（pending → 成功）でも、記事一覧が 503 なら復帰待ちとして残す。二重に回しても重複しない', async () => {
  const pending: EntRecord = { plan: 'hp-bot-seo', state: 'active', event_at: T1, user_id: USER, event: 'readd', status: 'pending', attempts: 1, first_failed_at: T1, next_at: T1, last_http: 503, last_code: null, result: null, reactivate_pt: true };
  const w = world(); const db = fakeDb([site({ [ENT_KEY]: pending })]); w.state.articles = 503;
  await retryPendingEntitlements(db, w.deps);
  assert.equal(ent(db.sites[0])?.status, 'synced');
  assert.equal(rec(db.sites[0])?.state, 'pending');
  w.state.articles = 200; w.tick(2 * 3600_000);
  await Promise.all([retryPendingRecoveries(db, w.deps), retryPendingRecoveries(db, w.deps)]);
  assert.ok(w.actions().filter((a) => a === 'reactivate').length >= 1);
  assert.equal(rec(db.sites[0])?.state, 'done');
  // 再起動（新しい処理）でも、done は拾わない
  w.tick(3600_000);
  const n = w.actions().length;
  await retryPendingRecoveries(db, w.deps);
  assert.equal(w.actions().length, n);
});

test('10：公開先の恒久 4xx は再試行しない（要対応）。5xx・通信失敗は有限で再試行', async () => {
  let w = world(); let db = fakeDb([site()]); w.state.pt = [{ status: 401, body: { code: 'unauthorized' } }];
  await afterBillingChange(db, USER, UPGRADE[0], UPGRADE[1], 'upgrade', { ...w.deps, eventAt: T1 });
  assert.equal(rec(db.sites[0])?.state, 'needs_attention');
  w.tick(2 * 3600_000); await retryPendingRecoveries(db, w.deps);
  assert.equal(w.actions().filter((a) => a === 'reactivate').length, 1, '恒久 4xx を再試行した');
  w = world(); db = fakeDb([site()]); w.state.pt = [{ status: 503 }];
  await afterBillingChange(db, USER, UPGRADE[0], UPGRADE[1], 'upgrade', { ...w.deps, eventAt: T1 });
  assert.equal(rec(db.sites[0])?.state, 'pending');
  w.state.pt = [{ status: 200, body: { ok: true, registration: { state: 'active' } } }];
  w.tick(2 * 3600_000); await retryPendingRecoveries(db, w.deps);
  assert.equal(rec(db.sites[0])?.state, 'done');
});

test('9：復帰待ちの保存と Studio の保存が重なっても、利用者の設定を古い値で戻さない', async () => {
  const w = world(); const db = fakeDb([site()]); w.state.articles = 503;
  let once = true;
  db.hooks.beforeUpdate = (rows) => {
    if (!once) return; once = false;
    rows[0].settings_json = { ...(rows[0].settings_json as Record<string, unknown>), heroTitle: '利用者が今書いた見出し' };
    rows[0].updated_at = 't-user';
  };
  await afterBillingChange(db, USER, UPGRADE[0], UPGRADE[1], 'upgrade', { ...w.deps, eventAt: T1 });
  const st = db.sites[0].settings_json as Record<string, unknown>;
  assert.equal(st.heroTitle, '利用者が今書いた見出し');
  assert.ok(rec(db.sites[0]), '復帰待ちが残っていない');
});

test('13：内部の状態は利用者が書き換えられない（サーバー所有）・公開 HTML に出ない', () => {
  assert.match(readFileSync('lib/laru-entitlement.ts', 'utf8'), /'larubotPublicationRecovery'/);
  const exp = readFileSync('lib/html-export.ts', 'utf8') + readFileSync('lib/published-head.ts', 'utf8');
  assert.ok(!/larubotPublicationRecovery|larubotEntitlement/.test(exp));
});

test('11・12：通知は同じ障害（サイト・状態の時刻・段階）で 1 日 1 通まで。別サイト・別イベント・別段階は別。本文は同じキーで同じ', async () => {
  const base = { kind: 'entitlement_record' as const, userId: USER, plan: 'hp-bot-seo', siteId: SITE_ID, reason: '控えを保存できません', dedupe: `active|${T1}` };
  const day1 = new Date('2026-10-18T03:00:00Z'), day1b = new Date('2026-10-18T14:00:00Z'), day2 = new Date('2026-10-19T16:00:00Z');
  const k = alertIdempotencyKey(base, day1);
  assert.equal(k, alertIdempotencyKey({ ...base, status: 503 }, day1b), '試行・状態コードでキーが変わった');
  assert.notEqual(k, alertIdempotencyKey({ ...base, siteId: '22222222-2222-4222-8222-222222222222' }, day1));
  assert.notEqual(k, alertIdempotencyKey({ ...base, dedupe: `active|2026-10-06T00:00:00.000Z` }, day1));
  assert.notEqual(k, alertIdempotencyKey({ ...base, kind: 'publication_recovery' }, day1));
  assert.notEqual(k, alertIdempotencyKey(base, day2), '日をまたいだ再通知（1 日 1 通）');
  assert.ok(k.length <= 256 && !k.includes(T1) && !/控え/.test(k), '長い理由をそのまま切り詰めて使っている');
  assert.equal(JSON.stringify(alertMessage(base)), JSON.stringify(alertMessage({ ...base, status: 502 })), '同じキーで本文が変わる（変わる詳細はログへ）');
  // 文面：控えの保存失敗を「Bot/SEO が付いていない」と断定しない・課金のやり直しを案内しない
  const m = alertMessage(base).html;
  assert.ok(!/ボットやSEOが付いていない|プランを付け直す|契約を叩き直す/.test(m));
  assert.match(m, /管理画面の照合/);
  assert.ok(!/ボットやSEOが付いていない/.test(alertMessage({ ...base, kind: 'publication_recovery' }).html));
  // 関係ない種類の文面は変えない
  assert.match(alertMessage({ kind: 'register', userId: USER, reason: 'x' }).html, /プランを付け直す/);
  // 反復して呼んでも、送る要求は同じキー（プロバイダー側で 1 通にまとまる）
  const sent: string[] = [];
  process.env.ADMIN_EMAIL = 'ops@example.com'; process.env.RESEND_API_KEY = 're_test';
  for (let i = 0; i < 5; i++) await alertLarubotFailure({ ...base, status: 500 + i }, { now: () => day1, send: async (_p, o) => { sent.push(o.idempotencyKey); return { error: null }; } });
  delete process.env.RESEND_API_KEY; delete process.env.ADMIN_EMAIL;
  assert.equal(new Set(sent).size, 1);
});

test('レビュー：控えの無い支払い回復は LARUbot の status が hp active + seo のときだけ戻す', async () => {
  const recover = [{ plan: 'hp-bot-seo', status: 'past_due' }, { plan: 'hp-bot-seo', status: 'active' }] as const;
  for (const [body, want] of [
    [{ entitlement: { plan: 'starter', seo: true, hp: { state: 'active', seo: true } } }, ['reactivate']],
    [{ entitlement: { plan: 'starter', seo: true, hp: null } }, []],
    [{ entitlement: { hp: { state: 'active' } } }, []],
    [{ entitlement: { hp: { state: 'cancelled', seo: true } } }, []],
  ] as const) {
    const w = world(); const db = fakeDb([site()]);
    w.state.status = { status: 200, body };
    await afterBillingChange(db, USER, recover[0], recover[1], 'recover', { ...w.deps, eventAt: T1 });
    assert.deepEqual(w.actions(), want, JSON.stringify(body));
  }
});

test('レビュー：公開先の会社 ID（laruseoPublicId）だけが変わっても中止する', async () => {
  const w = world(); const db = fakeDb([site()]); w.state.articles = 503;
  await afterBillingChange(db, USER, UPGRADE[0], UPGRADE[1], 'upgrade', { ...w.deps, eventAt: T1 });
  (db.sites[0].settings_json as Record<string, unknown>).laruseoPublicId = 'pid-other';
  w.state.articles = 200; w.tick(2 * 3600_000);
  await retryPendingRecoveries(db, w.deps);
  assert.deepEqual(w.actions(), []);
  assert.equal(rec(db.sites[0])?.state, 'cancelled');
});

test('レビュー：reactivate の最中に非公開・SEO 解除が入ったら、すぐ deactivate で戻し、復帰待ちは中止', async () => {
  for (const [name, change] of [
    ['非公開', (db: ReturnType<typeof fakeDb>) => { db.sites[0].published = false; }],
    ['SEO 解除', (db: ReturnType<typeof fakeDb>) => { db.profile.plan = 'hp-bot'; }],
  ] as const) {
    const w = world(); const db = fakeDb([site()]); w.state.articles = 503;
    await afterBillingChange(db, USER, UPGRADE[0], UPGRADE[1], 'upgrade', { ...w.deps, eventAt: T1 });
    w.state.onPt = (b) => { if (b.action === 'reactivate') change(db); };
    w.state.articles = 200; w.tick(2 * 3600_000);
    await retryPendingRecoveries(db, w.deps);
    assert.deepEqual(w.actions(), ['reactivate', 'deactivate'], name);
    assert.equal(rec(db.sites[0])?.state, 'cancelled', name);
    assert.match(String(rec(db.sites[0])?.last_reason), /_after_reactivate$/, name);
  }
});

test('レビュー：処理中に新しいイベントの復帰待ちが書かれたら、古い結果で上書きしない', async () => {
  const w = world(); const db = fakeDb([site()]); w.state.articles = 503;
  await afterBillingChange(db, USER, UPGRADE[0], UPGRADE[1], 'upgrade', { ...w.deps, eventAt: T1 });
  const T2 = '2026-10-06T01:00:00.000Z';
  let once = false;
  db.hooks.beforeUpdate = (rows) => {
    if (once) return; once = true;
    const sj = rows[0].settings_json as Record<string, unknown>;
    sj[RECOVERY_KEY] = { ...(sj[RECOVERY_KEY] as RecoveryRecord), event_at: T2, first_at: '2026-10-18T05:00:00.000Z', attempts: 0 };
    rows[0].updated_at = 'concurrent';
  };
  w.tick(2 * 3600_000); // まだ 503 のまま → 古いイベントの再試行結果を書こうとする
  await retryPendingRecoveries(db, w.deps);
  assert.equal(rec(db.sites[0])?.event_at, T2, '新しい復帰待ちを古い結果で上書きした');
  assert.equal(rec(db.sites[0])?.attempts, 0);
});

test('再レビュー：契約・LARUbot を一時的に読めないときは中止しない（待ちのまま）。戻した直後に読めなくても取り消さない', async () => {
  // 戻す前：契約を読めない → 待ちのまま（中止・取り消しなし）
  let w = world(); let db = fakeDb([site()]); w.state.articles = 503;
  await afterBillingChange(db, USER, UPGRADE[0], UPGRADE[1], 'upgrade', { ...w.deps, eventAt: T1 });
  db.hooks.failProfile = true; w.state.articles = 200; w.tick(2 * 3600_000);
  await retryPendingRecoveries(db, w.deps);
  assert.deepEqual(w.actions(), []);
  assert.equal(rec(db.sites[0])?.state, 'pending', '一時的な読み取り失敗で中止した');
  assert.equal(rec(db.sites[0])?.last_reason, 'owner_unreadable');
  db.hooks.failProfile = false; w.tick(2 * 3600_000);
  await retryPendingRecoveries(db, w.deps);
  assert.deepEqual(w.actions(), ['reactivate']);
  assert.equal(rec(db.sites[0])?.state, 'done');
  // 控えが無く LARUbot status が 503 → 待ちのまま
  const r0: RecoveryRecord = { public_id: 'pid-1', pt_public_id: 'pid-1', user_id: USER, event: 'recover', event_at: T1, state: 'pending', attempts: 1, first_at: '2026-10-18T00:00:00.000Z', next_at: '2026-10-18T00:00:00.000Z', last_reason: 'articles_not_ready', last_http: null };
  w = world(); db = fakeDb([site({ [RECOVERY_KEY]: r0 })]); w.state.status = { status: 503, body: {} };
  await retryPendingRecoveries(db, w.deps);
  assert.equal(rec(db.sites[0])?.state, 'pending');
  assert.equal(rec(db.sites[0])?.last_reason, 'status_unreachable');
  w.state.status = { status: 200, body: { entitlement: { hp: { state: 'active', seo: true } } } }; w.tick(2 * 3600_000);
  await retryPendingRecoveries(db, w.deps);
  assert.deepEqual(w.actions(), ['reactivate']);
  // 戻した直後の確認で契約を読めない → 取り消さない
  w = world(); db = fakeDb([site()]); w.state.articles = 503;
  await afterBillingChange(db, USER, UPGRADE[0], UPGRADE[1], 'upgrade', { ...w.deps, eventAt: T1 });
  w.state.onPt = (b) => { if (b.action === 'reactivate') db.hooks.failProfile = true; };
  w.state.articles = 200; w.tick(2 * 3600_000);
  await retryPendingRecoveries(db, w.deps);
  assert.deepEqual(w.actions(), ['reactivate'], '読めなかっただけで止め直した');
});

test('再レビュー：戻した直後に紐付けが変わったら、戻した相手（古い ID）を止める。止め直しに失敗したら要対応', async () => {
  let w = world(); let db = fakeDb([site()]); w.state.articles = 503;
  await afterBillingChange(db, USER, UPGRADE[0], UPGRADE[1], 'upgrade', { ...w.deps, eventAt: T1 });
  w.state.onPt = (b) => { if (b.action === 'reactivate') { const sj = db.sites[0].settings_json as Record<string, unknown>; sj.laruseoPublicId = 'pid-new'; sj.larubotPublicId = 'pid-new'; } };
  w.state.articles = 200; w.tick(2 * 3600_000);
  await retryPendingRecoveries(db, w.deps);
  const calls = w.state.calls.filter((c) => c.body?.action);
  assert.deepEqual(calls.map((c) => [c.body!.action, c.body!.public_id]), [['reactivate', 'pid-1'], ['deactivate', 'pid-1']]);
  assert.equal(rec(db.sites[0])?.state, 'cancelled');
  // 止め直しが 503 → 中止ではなく要対応
  w = world(); db = fakeDb([site()]); w.state.articles = 503;
  await afterBillingChange(db, USER, UPGRADE[0], UPGRADE[1], 'upgrade', { ...w.deps, eventAt: T1 });
  w.state.pt = [{ status: 200, body: { ok: true, changed: true, registration: { state: 'active' } } }, { status: 503, body: {} }];
  w.state.onPt = (b) => { if (b.action === 'reactivate') db.sites[0].published = false; };
  w.state.articles = 200; w.tick(2 * 3600_000);
  await retryPendingRecoveries(db, w.deps);
  assert.equal(w.actions()[0], 'reactivate');
  assert.ok(w.actions().slice(1).every((a) => a === 'deactivate') && w.actions().length >= 2);
  assert.equal(rec(db.sites[0])?.state, 'needs_attention');
  assert.match(String(rec(db.sites[0])?.last_reason), /unpublished_after_reactivate_undo_failed/);
});
