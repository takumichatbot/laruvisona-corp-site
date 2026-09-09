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
  operation_epoch: number;
  render_register_started_at: string | null;
  ownership_verified_at: string | null;
  external_registration_owned: boolean | null;
  release_operation_id: string | null;
  release_lease_until: string | null;
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
  agencyHosts?: string[];
  failApply?: boolean;
  failMarkRegisterStarted?: boolean;
  failFinishRelease?: boolean;
  /** applyCheck を呼ぶ直前に走らせる（競合の再現用） */
  beforeApply?: () => void;
}) {
  const rows: Row[] = opts.rows ? [...opts.rows] : [];
  const marks: string[] = [];
  const orphans: { host: string; renderDomainId: string; token: string; epoch: number; message: string }[] = [];
  let seq = 0;
  const store = {
    rows,
    marks,
    orphans,
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
        operation_epoch: 1, render_register_started_at: null, ownership_verified_at: null,
        external_registration_owned: null, release_operation_id: null, release_lease_until: null,
      };
      rows.push(row);
      return { ok: true as const, row };
    },
    async applyCheck(input: {
      siteId: string; host: string; fencingToken: string; epoch: number; status: DomainStatusT;
      renderDomainId: string | null; lastError: string | null; makePrimary: boolean;
    }) {
      opts.beforeApply?.();
      if (opts.failApply) return { ok: false as const, reason: 'error' as const, message: 'db down' };
      const row = rows.find(r => r.site_id === input.siteId && r.host === input.host);
      // 行が消えている / 作り直された / 世代が進んだ → 古い検証結果は適用しない
      // （supabase/site_domains.sql の laruhp_domain_apply_check と同じ条件）
      if (!row || row.verification_token !== input.fencingToken || row.operation_epoch !== input.epoch) {
        return { ok: false as const, reason: 'gone' as const };
      }
      if (row.status === 'release_pending') {
        return { ok: false as const, reason: 'releasing' as const };
      }
      row.status = input.status;
      row.render_domain_id = input.renderDomainId ?? row.render_domain_id;
      row.last_error = input.lastError;
      row.last_checked_at = 'now';
      let switched = false;
      // 自動採用は「いまも未設定」のときだけ（SQL側の where custom_domain is null と同じ）
      if (input.makePrimary && (input.status === 'connected' || input.status === 'legacy')
          && opts.sites[input.siteId].custom_domain === null) {
        opts.sites[input.siteId].custom_domain = input.host;
        switched = true;
      }
      return { ok: true as const, switched };
    },
    async setPrimary(siteId: string, host: string, fencingToken: string, epoch: number) {
      const row = rows.find(r => r.site_id === siteId && r.host === host);
      if (!row || row.verification_token !== fencingToken || row.operation_epoch !== epoch) {
        return { ok: false as const, reason: 'gone' as const };
      }
      if (row.status !== 'connected' && row.status !== 'legacy') {
        return { ok: false as const, reason: 'not_connected' as const };
      }
      opts.sites[siteId].custom_domain = host;
      return { ok: true as const };
    },
    async beginRelease(siteId: string, host: string) {
      const row = rows.find(r => r.site_id === siteId && r.host === host);
      if (!row) return { ok: false as const, reason: 'gone' as const };
      // 進行中の解除があれば新しい処理を始めない（SQLの release_lease_until と同じ）
      if (row.status === 'release_pending' && row.release_lease_until === 'active') {
        return { ok: false as const, reason: 'in_progress' as const };
      }
      if (opts.sites[siteId].custom_domain === host) opts.sites[siteId].custom_domain = null;
      // 外部登録の帰属は、status が変わる前の値から固定する（SQLと同じ）
      row.external_registration_owned = row.external_registration_owned ?? (
        row.render_domain_id !== null || row.render_register_started_at !== null || row.status === 'legacy'
      );
      row.status = 'release_pending';
      // 解除の開始で世代が進む＝進行中の検証は適用できなくなる
      row.operation_epoch += 1;
      row.release_operation_id = `op-${++seq}`;
      row.release_lease_until = 'active';
      return { ok: true as const, row: { ...row } };
    },
    async finishRelease(siteId: string, host: string, fencingToken: string, epoch: number) {
      if (opts.failFinishRelease) return { ok: false, message: 'db down' };
      const i = rows.findIndex(r => r.site_id === siteId && r.host === host
        && r.verification_token === fencingToken && r.operation_epoch === epoch);
      if (i < 0) return { ok: false, message: 'gone' };
      if (rows[i].status !== 'release_pending') return { ok: false, message: 'not_releasing' };
      rows.splice(i, 1);
      return { ok: true };
    },
    async markReleaseFailed(siteId: string, host: string, epoch: number, message: string) {
      const row = rows.find(r => r.site_id === siteId && r.host === host);
      if (!row || row.operation_epoch !== epoch || row.status !== 'release_pending') return;
      marks.push(`${host}:${message}`);
      row.last_error = message;
    },
    async markRegisterStarted(siteId: string, host: string, token: string, epoch: number) {
      if (opts.failMarkRegisterStarted) return { ok: false as const, reason: 'error' as const, message: 'db down' };
      const row = rows.find(r => r.site_id === siteId && r.host === host);
      if (!row) return { ok: false as const, reason: 'gone' as const };
      // epoch は作り直すと戻りうるので token も見る（SQLと同じ）
      if (row.verification_token !== token || row.operation_epoch !== epoch) {
        return { ok: false as const, reason: 'stale' as const };
      }
      if (row.status === 'release_pending') return { ok: false as const, reason: 'releasing' as const };
      row.render_register_started_at = row.render_register_started_at ?? 'now';
      return { ok: true as const };
    },

    async pinReleaseTarget(siteId: string, host: string, epoch: number, opId: string, renderDomainId: string) {
      const row = rows.find(r => r.site_id === siteId && r.host === host);
      if (!row) return { ok: false as const, reason: 'gone' as const };
      if (row.operation_epoch !== epoch || row.release_operation_id !== opId || row.status !== 'release_pending') {
        return { ok: false as const, reason: 'stale' as const };
      }
      row.render_domain_id = row.render_domain_id ?? renderDomainId;
      return { ok: true as const, renderDomainId: row.render_domain_id };
    },

    async claimRelease(siteId: string, host: string, epoch: number, opId: string) {
      const row = rows.find(r => r.site_id === siteId && r.host === host);
      if (!row) return { ok: false as const, reason: 'gone' as const };
      if (row.operation_epoch !== epoch || row.release_operation_id !== opId || row.status !== 'release_pending') {
        return { ok: false as const, reason: 'stale' as const };
      }
      return { ok: true as const, renderDomainId: row.render_domain_id };
    },

    async enqueueOrphanRegistration(siteId: string, host: string, renderDomainId: string, token: string, epoch: number, message: string) {
      orphans.push({ host, renderDomainId, token, epoch, message });
    },
    async isAgencyAdminHost(host: string) {
      return (opts.agencyHosts ?? []).includes(host);
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
    async findByHost(host: string) {
      this.calls.push(`find:${host}`);
      if (opts.unregister === 'fail') return { ok: false as const, message: 'Renderに接続できませんでした' };
      return { ok: true as const, domainId: opts.unregister === 'missing' ? null : 'rd_1' };
    },
    async unregisterById(id: string) {
      this.calls.push(`unregister:${id}`);
      if (opts.unregister === 'fail') return { ok: false as const, message: 'Renderに接続できませんでした' };
      return { ok: true as const, removed: true };
    },
  };
}

type ProbeR = 'reached' | 'not_reached' | 'unavailable';
function makeProbe(result: ProbeR | boolean) {
  const r: ProbeR = typeof result === 'boolean' ? (result ? 'reached' : 'not_reached') : result;
  return { calls: 0, async reachesService(): Promise<ProbeR> { this.calls++; return r; } };
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
    operation_epoch: 1, render_register_started_at: null, ownership_verified_at: null,
    external_registration_owned: null, release_operation_id: null, release_lease_until: null,
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
  assert.equal(res.evidence.probe, 'not_reached');
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

  // 再試行して成功すれば消える（占有が切れている前提）
  store.rows[0].release_lease_until = null;
  const render2 = makeRender('ok', { unregister: 'ok' });
  const again = await releaseDomain(deps(store, makeDns(), render2, makeProbe(true)),
    { siteId: 's1', userId: 'u1', host: 'example.com' });
  assert.equal(again.ok, true);
  if (again.ok) assert.equal(again.released, true);
  assert.equal(store.rows.length, 0);
});

test('R4: 外部IDを持たないlegacyでも、引き直して固定してから解除する', async () => {
  const sites = { s1: { user_id: 'u1', custom_domain: 'legacy.example' as string | null } };
  const store = makeStore({ sites, rows: [row('legacy.example', { status: 'legacy', render_domain_id: null })] });
  const render = makeRender('ok', { unregister: 'ok' });
  const res = await releaseDomain(deps(store, makeDns(), render, makeProbe(true)),
    { siteId: 's1', userId: 'u1', host: 'legacy.example' });

  assert.equal(res.ok, true);
  assert.ok(render.calls.includes('find:legacy.example'), 'legacyで外部の照会をしていない');
  assert.ok(render.calls.some(c => c.startsWith('unregister:')), 'legacyで外部解除を飛ばしている');
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

// ════════════════════════════════════════════════════════════
// 再レビュー(ecea9d0) R1: 外部解除の認可
// ════════════════════════════════════════════════════════════

test('R1: 所有確認も外部登録も通っていない候補の取消では、外部を呼ばない', async () => {
  const sites = { s1: { user_id: 'u1', custom_domain: null as string | null } };
  const store = makeStore({ sites, rows: [row('fresh.example', { status: 'pending_ownership' })] });
  const render = makeRender('ok', { unregister: 'ok' });

  const res = await releaseDomain(deps(store, makeDns(), render, makeProbe(true)),
    { siteId: 's1', userId: 'u1', host: 'fresh.example' });

  assert.equal(res.ok, true);
  if (res.ok) assert.equal(res.released, true, '候補の取消は完了する');
  assert.deepEqual(render.calls, [],
    'ホストが外部一覧にあるだけで削除を呼んでいる（他人の登録を消しうる）');
  assert.equal(store.rows.length, 0);
});

test('R1: 登録を呼んだ記録がある候補は、外部解除まで行う', async () => {
  // Renderへの登録が成功したのにDB保存前に落ちた場合の後始末
  const sites = { s1: { user_id: 'u1', custom_domain: null as string | null } };
  const store = makeStore({
    sites,
    rows: [row('started.example', { status: 'pending_dns', render_register_started_at: 'yesterday' })],
  });
  const render = makeRender('ok', { unregister: 'ok' });
  const res = await releaseDomain(deps(store, makeDns(), render, makeProbe(true)),
    { siteId: 's1', userId: 'u1', host: 'started.example' });
  assert.equal(res.ok, true);
  assert.ok(render.calls.some(c => c.startsWith('unregister:')), '回収できていない');
});

test('R1: 代理店の管理用ドメインは候補として登録できない', async () => {
  const store = makeStore({
    sites: { s1: { user_id: 'u1', custom_domain: null } },
    agencyHosts: ['agency-admin.example'],
  });
  const render = makeRender('ok');
  const res = await addDomain(deps(store, makeDns(), render, makeProbe(true)),
    { siteId: 's1', userId: 'u1', input: 'agency-admin.example' });

  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.status, 409);
  assert.equal(store.rows.length, 0, '他人の管理ホストを候補にできてしまう');
});

test('R1: 外部APIが未設定でも、過去に登録した記録があれば解除不要にしない', async () => {
  const sites = { s1: { user_id: 'u1', custom_domain: 'legacy.example' as string | null } };
  const store = makeStore({ sites, rows: [row('legacy.example', { status: 'legacy' })] });
  const render = makeRender('off');

  const res = await releaseDomain(deps(store, makeDns(), render, makeProbe(true)),
    { siteId: 's1', userId: 'u1', host: 'legacy.example' });

  assert.equal(res.ok, true);
  if (res.ok) assert.equal(res.released, false, '外部を確認できないのに完了扱いにしている');
  assert.equal(store.rows.length, 1, '記録が消えている');
  assert.equal(store.rows[0].status, 'release_pending');
  assert.equal(sites.s1.custom_domain, null, '配信は止める');
});

// ════════════════════════════════════════════════════════════
// 再レビュー R2/R3: 世代と確定条件（SQLと同じ意味で偽ストアを動かしている）
// ════════════════════════════════════════════════════════════

test('R2: 検証中に解除が始まったら、古い検証結果を適用しない', async () => {
  const sites = { s1: { user_id: 'u1', custom_domain: null as string | null } };
  const store = makeStore({
    sites,
    rows: [row('race.example')],
    // 外部確認のあと、確定の直前に解除が確定したのを再現
    beforeApply: () => {
      const r = store.rows[0];
      r.status = 'release_pending';
      r.operation_epoch += 1;
    },
  });
  const res = await verifyDomain(
    deps(store, makeDns({ txt: [challengeRecordValue(TOKEN)], a: [APEX_IP] }), makeRender('ok'), makeProbe(true)),
    { siteId: 's1', userId: 'u1', host: 'race.example' });

  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.status, 409);
  assert.equal(sites.s1.custom_domain, null, '解除中の行が主URLとして復活した');
  assert.equal(store.rows[0].status, 'release_pending');
});

test('R3: 検証中に利用者が主URLを選んだら、自動採用で上書きしない', async () => {
  const sites = { s1: { user_id: 'u1', custom_domain: null as string | null } };
  const store = makeStore({
    sites,
    rows: [row('auto.example')],
    // 外部確認の間に、利用者が別のドメインを明示的に選んだ
    beforeApply: () => { sites.s1.custom_domain = 'chosen.example'; },
  });
  const res = await verifyDomain(
    deps(store, makeDns({ txt: [challengeRecordValue(TOKEN)], a: [APEX_IP] }), makeRender('ok'), makeProbe(true)),
    { siteId: 's1', userId: 'u1', host: 'auto.example' });

  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.status, 'connected', '検証結果自体は保存される');
  assert.equal(res.switched, false, '自動採用されてしまった');
  assert.equal(sites.s1.custom_domain, 'chosen.example', '明示的に選んだ主URLが上書きされた');
});

// ════════════════════════════════════════════════════════════
// 再レビュー R4: 到達確認の信頼根拠
// ════════════════════════════════════════════════════════════

test('R4: 署名鍵が無い運用では、Renderの確認が取れないと接続済みにしない', async () => {
  const sites = { s1: { user_id: 'u1', custom_domain: null as string | null } };
  const store = makeStore({ sites, rows: [row('nokey.example')] });
  const res = await verifyDomain(
    deps(store, makeDns({ txt: [challengeRecordValue(TOKEN)], a: [APEX_IP] }), makeRender('down'), makeProbe('unavailable')),
    { siteId: 's1', userId: 'u1', host: 'nokey.example' });

  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.evidence.probe, 'unavailable');
  assert.notEqual(res.status, 'connected');
  assert.equal(sites.s1.custom_domain, null);
});

test('R4: 署名鍵が無い運用では、Renderがverifiedでも接続済みにしない', async () => {
  // 到達確認は必須。TLSと実際の応答を確かめずに主URLへ採用しない。
  const sites = { s1: { user_id: 'u1', custom_domain: null as string | null } };
  const store = makeStore({ sites, rows: [row('nokey2.example')] });
  const res = await verifyDomain(
    deps(store, makeDns({ txt: [challengeRecordValue(TOKEN)], a: [APEX_IP] }), makeRender('ok'), makeProbe('unavailable')),
    { siteId: 's1', userId: 'u1', host: 'nokey2.example' });
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.status, 'ssl_pending');
  assert.equal(sites.s1.custom_domain, null);
});

// ════════════════════════════════════════════════════════════
// 再々レビュー(4cee5c0) R1: 外部呼び出しが遅れたときの順序
//
// 監督が再現した順序:
//   解除Aが外部照会で止まる → 解除Bが完了して行が消える →
//   同じホストが新しいtoken・新しい外部IDで再登録される →
//   遅れていた解除Aが再開する
// このとき、解除Aが provider-new を削除してはいけない。
// ════════════════════════════════════════════════════════════

test('R1: 遅れて再開した解除は、固定済みの古いIDだけを消す', async () => {
  const sites = { s1: { user_id: 'u1', custom_domain: 'race.example' as string | null } };
  const store = makeStore({
    sites,
    rows: [row('race.example', { status: 'connected', render_domain_id: 'provider-old', verification_token: 'tok-old' })],
  });

  const deleted: string[] = [];
  let gate: (() => void) | null = null;
  const opened = new Promise<void>(r => { gate = r; });
  let firstDelete = true;

  const render = {
    calls: [] as string[],
    configured() { return true; },
    async register() { return { ok: true as const, domainId: 'x' }; },
    async find(host: string) { return { ok: true as const, domain: { id: 'provider-old', name: host, verificationStatus: 'verified' } }; },
    async findByHost() { return { ok: true as const, domainId: 'provider-old' }; },
    async unregisterById(id: string) {
      // 1回目（解除A）の削除呼び出しだけ、外部側で遅らせる
      if (firstDelete) { firstDelete = false; await opened; }
      deleted.push(id);
      return { ok: true as const, removed: true };
    },
  };

  const d = deps(store, makeDns(), render, makeProbe(true));

  // 解除Aを開始し、外部削除の途中で止める
  const aPromise = releaseDomain(d, { siteId: 's1', userId: 'u1', host: 'race.example' });
  await new Promise(r => setTimeout(r, 0));

  // その間に、行が消えて同じホストが新しいtoken・新しいIDで再登録される
  store.rows.length = 0;
  store.rows.push(row('race.example', {
    id: 'd9', status: 'connected', render_domain_id: 'provider-new',
    verification_token: 'tok-new', operation_epoch: 1,
  }));
  sites.s1.custom_domain = 'race.example';

  gate!();
  const a = await aPromise;

  assert.deepEqual(deleted, ['provider-old'],
    '遅れた解除が新しい世代の外部IDを消した');
  assert.equal(store.rows.length, 1, '再登録した行が消えた');
  assert.equal(store.rows[0].render_domain_id, 'provider-new');
  assert.equal(store.rows[0].status, 'connected', '再登録した行が解除待ちにされた');
  assert.equal(sites.s1.custom_domain, 'race.example', '再登録後の主URLが落ちた');
  // 後始末（finish_release）は世代・トークンが合わないので通らない
  assert.equal(a.ok, true);
  if (a.ok) assert.equal(a.released, false);
});

test('R1: 外部照会が遅れている間に状況が変わったら、固定せず削除もしない', async () => {
  // 行にIDが無い（legacy）ので、外部一覧から引いてから固定する。
  // 引いている間に別の解除が完了し、同じホストが再登録された場合。
  const sites = { s1: { user_id: 'u1', custom_domain: 'legacy-race.example' as string | null } };
  const store = makeStore({
    sites,
    rows: [row('legacy-race.example', { status: 'legacy', render_domain_id: null, verification_token: 'tok-old' })],
  });

  const deleted: string[] = [];
  let gate: (() => void) | null = null;
  const opened = new Promise<void>(r => { gate = r; });

  const render = {
    calls: [] as string[],
    configured() { return true; },
    async register() { return { ok: true as const, domainId: 'x' }; },
    async find(host: string) { return { ok: true as const, domain: { id: 'provider-new', name: host, verificationStatus: 'verified' } }; },
    async findByHost() {
      await opened;              // 照会が遅れる
      return { ok: true as const, domainId: 'provider-new' }; // 引いた時点では新しいIDが返る
    },
    async unregisterById(id: string) { deleted.push(id); return { ok: true as const, removed: true }; },
  };

  const d = deps(store, makeDns(), render, makeProbe(true));
  const aPromise = releaseDomain(d, { siteId: 's1', userId: 'u1', host: 'legacy-race.example' });
  await new Promise(r => setTimeout(r, 0));

  // 照会の間に行が消え、同じホストが再登録される
  store.rows.length = 0;
  store.rows.push(row('legacy-race.example', {
    id: 'd9', status: 'connected', render_domain_id: 'provider-new',
    verification_token: 'tok-new', operation_epoch: 1,
  }));
  sites.s1.custom_domain = 'legacy-race.example';

  gate!();
  const a = await aPromise;

  assert.deepEqual(deleted, [], '引き直した新しいIDを削除してしまった');
  assert.equal(a.ok, false, '状況が変わったのに成功として返している');
  if (!a.ok) assert.equal(a.status, 409);
  assert.equal(store.rows[0].render_domain_id, 'provider-new');
  assert.equal(sites.s1.custom_domain, 'legacy-race.example');
});

test('R1: 解除が動いている間、同じホストの解除をもう1本始めない', async () => {
  const sites = { s1: { user_id: 'u1', custom_domain: 'dup.example' as string | null } };
  const store = makeStore({
    sites,
    rows: [row('dup.example', { status: 'connected', render_domain_id: 'provider-old' })],
  });
  const render = makeRender('ok', { unregister: 'fail' });
  const d = deps(store, makeDns(), render, makeProbe(true));

  // 1本目は外部解除に失敗して release_pending のまま残る（占有は続く）
  const first = await releaseDomain(d, { siteId: 's1', userId: 'u1', host: 'dup.example' });
  assert.equal(first.ok, true);

  const second = await releaseDomain(d, { siteId: 's1', userId: 'u1', host: 'dup.example' });
  assert.equal(second.ok, false, '2本目の解除が並行して外部へ出ていく');
  if (!second.ok) assert.equal(second.status, 409);
});

// ════════════════════════════════════════════════════════════
// R2: 登録開始の記録と、記録できなかった登録の回収
// ════════════════════════════════════════════════════════════

test('R2: 登録開始を記録できなければ、外部登録を呼ばない', async () => {
  const sites = { s1: { user_id: 'u1', custom_domain: null as string | null } };
  const store = makeStore({ sites, rows: [row('nomark.example')], failMarkRegisterStarted: true });
  const render = makeRender('ok');

  const res = await verifyDomain(
    deps(store, makeDns({ txt: [challengeRecordValue(TOKEN)], a: [APEX_IP] }), render, makeProbe(true)),
    { siteId: 's1', userId: 'u1', host: 'nomark.example' });

  assert.equal(res.ok, true);
  assert.equal(render.calls.filter(c => c.startsWith('register:')).length, 0,
    '記録できていないのに外部登録を呼んだ');
  if (res.ok) assert.ok(res.lastError, '理由が残っていない');
});

test('R2: 解除中のドメインには登録開始を記録せず、外部登録もしない', async () => {
  const sites = { s1: { user_id: 'u1', custom_domain: null as string | null } };
  const store = makeStore({ sites, rows: [row('rel.example', { status: 'release_pending' })] });
  const render = makeRender('ok');
  const res = await verifyDomain(
    deps(store, makeDns({ txt: [challengeRecordValue(TOKEN)] }), render, makeProbe(true)),
    { siteId: 's1', userId: 'u1', host: 'rel.example' });
  // verify 自体が解除中を拒否する
  assert.equal(res.ok, false);
  assert.deepEqual(render.calls, []);
});

test('R2: 登録できたのに記録できなかったら、帰属付きで回収へ回す', async () => {
  const sites = { s1: { user_id: 'u1', custom_domain: null as string | null } };
  const store = makeStore({
    sites,
    rows: [row('orphan.example')],
    // 外部登録のあと、確定の直前に行が消える
    beforeApply: () => { store.rows.length = 0; },
  });
  const render = makeRender('ok');

  const res = await verifyDomain(
    deps(store, makeDns({ txt: [challengeRecordValue(TOKEN)], a: [APEX_IP] }), render, makeProbe(true)),
    { siteId: 's1', userId: 'u1', host: 'orphan.example' });

  assert.equal(res.ok, false, '保存できていないのに成功として返している');
  assert.equal(store.orphans.length, 1, '作った外部登録が追跡できていない');
  assert.equal(store.orphans[0].host, 'orphan.example');
  assert.equal(store.orphans[0].renderDomainId, 'rd_1');
  assert.equal(store.orphans[0].token, TOKEN, '行の同一性が残っていない');
});
