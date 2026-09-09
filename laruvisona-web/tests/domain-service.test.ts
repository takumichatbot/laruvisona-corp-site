// 独自ドメインの実処理（lib/domain-service.ts）を、偽のポートで実行する回帰テスト。
//
// ソース文字列の検査ではなく、addDomain / verifyDomain / setPrimaryDomain /
// releaseDomain を実際に呼んで、返り値と保存後の状態を検査する。
// 監督レビュー(3097db2)で模擬再現された6件は、すべてここで固定している。

import assert from 'node:assert/strict';
import test from 'node:test';

const {
  addDomain, verifyDomain, setPrimaryDomain, releaseDomain,
} = await import('../lib/domain-service.ts');
type DomainStatusT = import('../lib/domain.ts').DomainStatus;
const { challengeRecordValue } = await import('../lib/domain.ts');

type Row = {
  id: string; site_id: string; host: string; status: DomainStatusT;
  verification_token: string; render_domain_id: string | null;
  last_error: string | null; last_checked_at: string | null;
};

const TARGET = 'laruvisona-corp-site.onrender.com';
const APEX_IP = '216.24.57.1';

/**
 * DBの偽物。SQL側の約束（fencing tokenの一致、行が消えていたら適用しない、
 * 状態更新と配信ポインタの更新を一緒に行う）を、そのまま同じ意味で再現する。
 */
function makeStore(opts: {
  sites: Record<string, { user_id: string; custom_domain: string | null }>;
  rows?: Row[];
  failApply?: boolean;
  failFinishRelease?: boolean;
  /** applyCheck を呼ぶ直前に走らせる（競合の再現用） */
  beforeApply?: () => void;
}) {
  const rows: Row[] = opts.rows ? [...opts.rows] : [];
  const marks: string[] = [];
  let seq = 0;
  const store = {
    rows,
    marks,
    async getOwnedSite(siteId: string, userId: string) {
      const s = opts.sites[siteId];
      if (!s || s.user_id !== userId) return null;
      return { id: siteId, custom_domain: s.custom_domain };
    },
    async listDomains(siteId: string) { return rows.filter(r => r.site_id === siteId); },
    async getDomain(siteId: string, host: string) {
      return rows.find(r => r.site_id === siteId && r.host === host) ?? null;
    },
    async addDomain(siteId: string, host: string, token: string) {
      if (rows.some(r => r.host === host)) return { ok: false as const, reason: 'taken' as const };
      const row: Row = {
        id: `d${++seq}`, site_id: siteId, host, status: 'pending_ownership',
        verification_token: token, render_domain_id: null, last_error: null, last_checked_at: null,
      };
      rows.push(row);
      return { ok: true as const, row };
    },
    async applyCheck(input: {
      siteId: string; host: string; fencingToken: string; status: DomainStatusT;
      renderDomainId: string | null; lastError: string | null; makePrimary: boolean;
    }) {
      opts.beforeApply?.();
      if (opts.failApply) return { ok: false as const, reason: 'error' as const, message: 'db down' };
      const row = rows.find(r => r.site_id === input.siteId && r.host === input.host);
      // 行が消えている / 作り直された → 古い検証結果は適用しない
      if (!row || row.verification_token !== input.fencingToken) {
        return { ok: false as const, reason: 'gone' as const };
      }
      row.status = input.status;
      row.render_domain_id = input.renderDomainId ?? row.render_domain_id;
      row.last_error = input.lastError;
      row.last_checked_at = 'now';
      let switched = false;
      if (input.makePrimary && (input.status === 'connected' || input.status === 'legacy')) {
        opts.sites[input.siteId].custom_domain = input.host;
        switched = true;
      }
      return { ok: true as const, switched };
    },
    async setPrimary(siteId: string, host: string, fencingToken: string) {
      const row = rows.find(r => r.site_id === siteId && r.host === host);
      if (!row || row.verification_token !== fencingToken) return { ok: false as const, reason: 'gone' as const };
      if (row.status !== 'connected' && row.status !== 'legacy') {
        return { ok: false as const, reason: 'not_connected' as const };
      }
      opts.sites[siteId].custom_domain = host;
      return { ok: true as const };
    },
    async beginRelease(siteId: string, host: string) {
      const row = rows.find(r => r.site_id === siteId && r.host === host);
      if (!row) return { ok: false as const, reason: 'gone' as const };
      if (opts.sites[siteId].custom_domain === host) opts.sites[siteId].custom_domain = null;
      row.status = 'release_pending';
      return { ok: true as const, row };
    },
    async finishRelease(siteId: string, host: string, fencingToken: string) {
      if (opts.failFinishRelease) return { ok: false, message: 'db down' };
      const i = rows.findIndex(r => r.site_id === siteId && r.host === host && r.verification_token === fencingToken);
      if (i < 0) return { ok: false, message: 'gone' };
      rows.splice(i, 1);
      return { ok: true };
    },
    async markReleaseFailed(siteId: string, host: string, message: string) {
      marks.push(`${host}:${message}`);
      const row = rows.find(r => r.site_id === siteId && r.host === host);
      if (row) { row.status = 'release_pending'; row.last_error = message; }
    },
  };
  return store;
}

function makeDns(map: { txt?: string[]; cname?: string[]; a?: string[] } = {}) {
  return {
    calls: [] as string[],
    async txt(name: string) { this.calls.push(`txt:${name}`); return map.txt ?? []; },
    async cname(host: string) { this.calls.push(`cname:${host}`); return map.cname ?? []; },
    async a(host: string) { this.calls.push(`a:${host}`); return map.a ?? []; },
  };
}

function makeRender(mode: 'ok' | 'unverified' | 'down' | 'off', opts: { unregister?: 'ok' | 'fail' | 'missing' } = {}) {
  return {
    calls: [] as string[],
    configured() { return mode !== 'off'; },
    async register(host: string) {
      this.calls.push(`register:${host}`);
      if (mode === 'down') return { ok: false as const, message: 'Renderに接続できませんでした' };
      return { ok: true as const, domainId: 'rd_1' };
    },
    async find(host: string) {
      this.calls.push(`find:${host}`);
      if (mode === 'down') return { ok: false as const, message: 'Renderに接続できませんでした' };
      return { ok: true as const, domain: { id: 'rd_1', name: host, verificationStatus: mode === 'ok' ? 'verified' : 'pending' } };
    },
    async unregisterByHost(host: string) {
      this.calls.push(`unregister:${host}`);
      if (opts.unregister === 'fail') return { ok: false as const, message: 'Renderに接続できませんでした' };
      return { ok: true as const, removed: opts.unregister !== 'missing' };
    },
  };
}

function makeProbe(reachable: boolean) {
  return { calls: 0, async reachesService() { this.calls++; return reachable; } };
}

function deps(store: ReturnType<typeof makeStore>, dns: ReturnType<typeof makeDns>, render: ReturnType<typeof makeRender>, probe: ReturnType<typeof makeProbe>) {
  return {
    store, dns, render, probe,
    expectedTarget: TARGET,
    expectedApexIps: [APEX_IP],
    mainHost: 'https://laruvisona.jp',
  };
}

const TOKEN = 'a'.repeat(32);
function row(host: string, over: Partial<Row> = {}): Row {
  return {
    id: 'd1', site_id: 's1', host, status: 'pending_ownership',
    verification_token: TOKEN, render_domain_id: null, last_error: null, last_checked_at: null,
    ...over,
  };
}
const OWNER = { s1: { user_id: 'u1', custom_domain: null as string | null } };

// ── 追加 ──────────────────────────────────────────────

test('追加は所有者だけができ、他人のサイトIDでは何も起きない', async () => {
  const store = makeStore({ sites: { s1: { user_id: 'u1', custom_domain: null } } });
  const render = makeRender('ok');
  const d = deps(store, makeDns(), render, makeProbe(true));

  const res = await addDomain(d, { siteId: 's1', userId: 'other', input: 'example.com' });
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.status, 404);
  assert.equal(store.rows.length, 0, '他人のサイトに行が作られた');
  assert.deepEqual(render.calls, [], '所有者でないのに外部を呼んだ');
});

test('追加しただけでは配信先にならず、外部登録もしない', async () => {
  const sites = { s1: { user_id: 'u1', custom_domain: null as string | null } };
  const store = makeStore({ sites });
  const render = makeRender('ok');
  const res = await addDomain(deps(store, makeDns(), render, makeProbe(true)),
    { siteId: 's1', userId: 'u1', input: ' HTTPS://Example.com/path ' });
  assert.equal(res.ok, true);
  if (res.ok) assert.equal(res.host, 'example.com');
  assert.equal(store.rows[0].status, 'pending_ownership');
  assert.equal(sites.s1.custom_domain, null);
  assert.deepEqual(render.calls, []);
});

test('自社ドメインと重複ホストは受け付けない', async () => {
  const store = makeStore({ sites: { s1: { user_id: 'u1', custom_domain: null } }, rows: [row('taken.example')] });
  const d = deps(store, makeDns(), makeRender('ok'), makeProbe(true));

  const reserved = await addDomain(d, { siteId: 's1', userId: 'u1', input: 'www.laruvisona.jp' });
  assert.equal(reserved.ok, false);
  if (!reserved.ok) assert.equal(reserved.status, 400);

  const dup = await addDomain(d, { siteId: 's1', userId: 'u1', input: 'taken.example' });
  assert.equal(dup.ok, false);
  if (!dup.ok) assert.equal(dup.status, 409);
});

// ── 検証（正常系）────────────────────────────────────

test('所有確認・到達確認・Render確認がそろえば接続済みになり、主URLが空なら採用する', async () => {
  const sites = { s1: { user_id: 'u1', custom_domain: null as string | null } };
  const store = makeStore({ sites, rows: [row('example.com')] });
  const dns = makeDns({ txt: [challengeRecordValue(TOKEN)], a: [APEX_IP] });
  const res = await verifyDomain(deps(store, dns, makeRender('ok'), makeProbe(true)),
    { siteId: 's1', userId: 'u1', host: 'example.com' });

  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.status, 'connected');
  assert.equal(res.switched, true);
  assert.equal(sites.s1.custom_domain, 'example.com');
  assert.equal(res.evidence.renderCheck, 'verified');
});

test('所有確認が取れないうちは外部登録もしない', async () => {
  const store = makeStore({ sites: { s1: { user_id: 'u1', custom_domain: null } }, rows: [row('example.com')] });
  const render = makeRender('ok');
  const probe = makeProbe(true);
  const res = await verifyDomain(deps(store, makeDns({ a: [APEX_IP] }), render, probe),
    { siteId: 's1', userId: 'u1', host: 'example.com' });

  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.status, 'pending_ownership');
  assert.deepEqual(render.calls, [], '所有確認前にRenderを呼んでいる');
  assert.equal(probe.calls, 0, '所有確認前に到達確認をしている');
});

// ── R2: Renderの失敗を成功に変換しない ────────────────

test('R2: Renderの登録も照会も失敗したら、到達できていても接続済みにしない', async () => {
  const sites = { s1: { user_id: 'u1', custom_domain: null as string | null } };
  const store = makeStore({ sites, rows: [row('example.com')] });
  const res = await verifyDomain(
    deps(store, makeDns({ txt: [challengeRecordValue(TOKEN)], a: [APEX_IP] }), makeRender('down'), makeProbe(true)),
    { siteId: 's1', userId: 'u1', host: 'example.com' });

  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.evidence.renderCheck, 'unavailable');
  assert.notEqual(res.status, 'connected');
  assert.equal(res.switched, false);
  assert.equal(sites.s1.custom_domain, null, 'Render確認が取れていないのに配信先を変えた');
  assert.ok(res.lastError, '失敗の理由が残っていない');
});

test('R2: Renderが未検証のままなら接続済みにしない', async () => {
  const sites = { s1: { user_id: 'u1', custom_domain: null as string | null } };
  const store = makeStore({ sites, rows: [row('example.com')] });
  const res = await verifyDomain(
    deps(store, makeDns({ txt: [challengeRecordValue(TOKEN)], a: [APEX_IP] }), makeRender('unverified'), makeProbe(true)),
    { siteId: 's1', userId: 'u1', host: 'example.com' });
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.status, 'ssl_pending');
  assert.equal(sites.s1.custom_domain, null);
});

test('R2: このサービスへ到達できないなら接続済みにしない（404や別ホストの応答で通さない）', async () => {
  const sites = { s1: { user_id: 'u1', custom_domain: null as string | null } };
  const store = makeStore({ sites, rows: [row('example.com')] });
  const res = await verifyDomain(
    deps(store, makeDns({ txt: [challengeRecordValue(TOKEN)], a: [APEX_IP] }), makeRender('ok'), makeProbe(false)),
    { siteId: 's1', userId: 'u1', host: 'example.com' });
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.evidence.reachesService, false);
  assert.notEqual(res.status, 'connected');
  assert.equal(sites.s1.custom_domain, null);
});

test('Render未設定の運用では、到達確認だけで接続済みにする', async () => {
  const sites = { s1: { user_id: 'u1', custom_domain: null as string | null } };
  const store = makeStore({ sites, rows: [row('example.com')] });
  const res = await verifyDomain(
    deps(store, makeDns({ txt: [challengeRecordValue(TOKEN)] }), makeRender('off'), makeProbe(true)),
    { siteId: 's1', userId: 'u1', host: 'example.com' });
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.evidence.renderCheck, 'not_configured');
  assert.equal(res.status, 'connected');
});

test('公開DNSにレコードが見えなくても、到達できれば接続済みになる（Cloudflareプロキシ）', async () => {
  const store = makeStore({ sites: { s1: { user_id: 'u1', custom_domain: null } }, rows: [row('example.com')] });
  const res = await verifyDomain(
    deps(store, makeDns({ txt: [challengeRecordValue(TOKEN)], cname: [], a: ['104.21.0.1'] }), makeRender('ok'), makeProbe(true)),
    { siteId: 's1', userId: 'u1', host: 'example.com' });
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.evidence.dnsPointsHere, false);
  assert.equal(res.status, 'connected');
});

// ── R3: DB失敗・競合 ──────────────────────────────────

test('R3: 状態の保存に失敗したら、成功として返さず配信先も変えない', async () => {
  const sites = { s1: { user_id: 'u1', custom_domain: null as string | null } };
  const store = makeStore({ sites, rows: [row('example.com')], failApply: true });
  const res = await verifyDomain(
    deps(store, makeDns({ txt: [challengeRecordValue(TOKEN)], a: [APEX_IP] }), makeRender('ok'), makeProbe(true)),
    { siteId: 's1', userId: 'u1', host: 'example.com' });

  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.status, 500);
  assert.equal(sites.s1.custom_domain, null, '保存に失敗したのに配信先を変えた');
});

test('R3: 検証中に候補が削除されたら、削除済みホストを配信先にしない', async () => {
  const sites = { s1: { user_id: 'u1', custom_domain: null as string | null } };
  const store = makeStore({
    sites,
    rows: [row('example.com')],
    // 外部確認のあと、確定の直前に別リクエストが削除したのを再現
    beforeApply: () => { store.rows.length = 0; },
  });
  const res = await verifyDomain(
    deps(store, makeDns({ txt: [challengeRecordValue(TOKEN)], a: [APEX_IP] }), makeRender('ok'), makeProbe(true)),
    { siteId: 's1', userId: 'u1', host: 'example.com' });

  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.status, 409);
  assert.equal(sites.s1.custom_domain, null, '削除済みホストが配信先になった');
});

test('R3: 行が作り直されていたら、古い検証結果を適用しない', async () => {
  const sites = { s1: { user_id: 'u1', custom_domain: null as string | null } };
  const store = makeStore({
    sites,
    rows: [row('example.com')],
    beforeApply: () => { store.rows[0].verification_token = 'b'.repeat(32); },
  });
  const res = await verifyDomain(
    deps(store, makeDns({ txt: [challengeRecordValue(TOKEN)], a: [APEX_IP] }), makeRender('ok'), makeProbe(true)),
    { siteId: 's1', userId: 'u1', host: 'example.com' });
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.status, 409);
  assert.equal(sites.s1.custom_domain, null);
});

// ── R6: 明示的な主ドメイン切替 ────────────────────────

test('R6: 旧ドメインが正常でも、新ドメインを明示的に主URLへ切り替えられる', async () => {
  const sites = { s1: { user_id: 'u1', custom_domain: 'old.example' as string | null } };
  const store = makeStore({
    sites,
    rows: [
      row('old.example', { id: 'd0', status: 'connected', verification_token: 'o'.repeat(32) }),
      row('new.example', { id: 'd1' }),
    ],
  });
  const d = deps(store, makeDns({ txt: [challengeRecordValue(TOKEN)], a: [APEX_IP] }), makeRender('ok'), makeProbe(true));

  const v = await verifyDomain(d, { siteId: 's1', userId: 'u1', host: 'new.example' });
  assert.equal(v.ok, true);
  if (!v.ok) return;
  assert.equal(v.status, 'connected');
  assert.equal(v.switched, false, '確認しただけで正規URLが移った');
  assert.equal(sites.s1.custom_domain, 'old.example');

  // 旧ドメインを解除せずに切り替えられること
  const p = await setPrimaryDomain(d, { siteId: 's1', userId: 'u1', host: 'new.example' });
  assert.equal(p.ok, true);
  assert.equal(sites.s1.custom_domain, 'new.example');
  assert.ok(store.rows.find(r => r.host === 'old.example'), '旧ドメインの記録が消えた');
});

test('R6: 確認が取れていないドメインは主URLにできない', async () => {
  const sites = { s1: { user_id: 'u1', custom_domain: null as string | null } };
  const store = makeStore({ sites, rows: [row('example.com', { status: 'pending_dns' })] });
  const res = await setPrimaryDomain(deps(store, makeDns(), makeRender('ok'), makeProbe(true)),
    { siteId: 's1', userId: 'u1', host: 'example.com' });
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.status, 409);
  assert.equal(sites.s1.custom_domain, null);
});

test('R6: 他人のサイトの主URLは変えられない', async () => {
  const sites = { s1: { user_id: 'u1', custom_domain: null as string | null } };
  const store = makeStore({ sites, rows: [row('example.com', { status: 'connected' })] });
  const res = await setPrimaryDomain(deps(store, makeDns(), makeRender('ok'), makeProbe(true)),
    { siteId: 's1', userId: 'attacker', host: 'example.com' });
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.status, 404);
});

// ── R4: 解除の再試行 ──────────────────────────────────

test('R4: 外部の解除に失敗したら記録を消さず、再試行できる状態で残す', async () => {
  const sites = { s1: { user_id: 'u1', custom_domain: 'example.com' as string | null } };
  const store = makeStore({ sites, rows: [row('example.com', { status: 'connected', render_domain_id: 'rd_1' })] });
  const render = makeRender('ok', { unregister: 'fail' });
  const res = await releaseDomain(deps(store, makeDns(), render, makeProbe(true)),
    { siteId: 's1', userId: 'u1', host: 'example.com' });

  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.released, false);
  assert.equal(sites.s1.custom_domain, null, '配信は先に止める');
  assert.equal(store.rows.length, 1, '解除に失敗したのに記録を消した');
  assert.equal(store.rows[0].status, 'release_pending');
  assert.ok(store.marks.length > 0, '失敗の記録が残っていない');

  // 再試行して成功すれば消える
  const render2 = makeRender('ok', { unregister: 'ok' });
  const again = await releaseDomain(deps(store, makeDns(), render2, makeProbe(true)),
    { siteId: 's1', userId: 'u1', host: 'example.com' });
  assert.equal(again.ok, true);
  if (again.ok) assert.equal(again.released, true);
  assert.equal(store.rows.length, 0);
});

test('R4: 外部IDを持たないlegacyでも、ホスト名で解除を試みる', async () => {
  const sites = { s1: { user_id: 'u1', custom_domain: 'legacy.example' as string | null } };
  const store = makeStore({ sites, rows: [row('legacy.example', { status: 'legacy', render_domain_id: null })] });
  const render = makeRender('ok', { unregister: 'ok' });
  const res = await releaseDomain(deps(store, makeDns(), render, makeProbe(true)),
    { siteId: 's1', userId: 'u1', host: 'legacy.example' });

  assert.equal(res.ok, true);
  assert.ok(render.calls.includes('unregister:legacy.example'), 'legacyで外部解除を飛ばしている');
  assert.equal(store.rows.length, 0);
  assert.equal(sites.s1.custom_domain, null);
});

test('R4: 記録の削除に失敗したら released=true を返さない', async () => {
  const sites = { s1: { user_id: 'u1', custom_domain: 'example.com' as string | null } };
  const store = makeStore({
    sites, rows: [row('example.com', { status: 'connected' })], failFinishRelease: true,
  });
  const res = await releaseDomain(deps(store, makeDns(), makeRender('ok', { unregister: 'ok' }), makeProbe(true)),
    { siteId: 's1', userId: 'u1', host: 'example.com' });
  assert.equal(res.ok, true);
  if (res.ok) assert.equal(res.released, false);
  assert.equal(store.rows.length, 1);
});

test('R4: 他人のサイトのドメインは解除できない', async () => {
  const sites = { s1: { user_id: 'u1', custom_domain: 'example.com' as string | null } };
  const store = makeStore({ sites, rows: [row('example.com', { status: 'connected' })] });
  const render = makeRender('ok', { unregister: 'ok' });
  const res = await releaseDomain(deps(store, makeDns(), render, makeProbe(true)),
    { siteId: 's1', userId: 'attacker', host: 'example.com' });
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.status, 404);
  assert.deepEqual(render.calls, [], '所有者でないのに外部解除を呼んだ');
  assert.equal(sites.s1.custom_domain, 'example.com');
});

test('解除処理中のドメインは検証し直せない', async () => {
  const store = makeStore({ sites: { ...OWNER }, rows: [row('example.com', { status: 'release_pending' })] });
  const res = await verifyDomain(deps(store, makeDns(), makeRender('ok'), makeProbe(true)),
    { siteId: 's1', userId: 'u1', host: 'example.com' });
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.status, 409);
});
