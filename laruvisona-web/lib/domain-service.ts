// 独自ドメインの追加・検証・主ドメイン切替・解除の本体。
//
// ここには外部への直接の依存を書かない。DB・DNS・Render・HTTPS到達確認は
// すべてポート（インターフェース）越しに呼ぶ。理由は2つ:
//   1. 失敗・競合の分岐が本体側に集まるので、順序と後始末を1か所で読める
//   2. 外部につながらない環境でも、偽のポートを渡して実処理をそのまま実行できる
//      （ソース文字列を正規表現で見るだけのテストにしないため）
//
// ルート側（app/api/...）はここを呼ぶだけの薄い層にする。

import {
  normalizeDomain,
  isReservedHost,
  generateVerificationToken,
  checkOwnership,
  checkPointsHere,
  deriveStatus,
  challengeRecordName,
  isServable,
  type DomainStatus,
  type RenderCheck,
} from './domain';

// ── ポート ────────────────────────────────────────────

export interface DomainRecord {
  id: string;
  site_id: string;
  host: string;
  status: DomainStatus;
  /**
   * 所有確認用のトークン。
   * 同時に検証と削除が走ったときの fencing token も兼ねる。
   * 行が消えて作り直されるとトークンも変わるので、
   * 古い検証結果が新しい行へ適用されることがない。
   */
  verification_token: string;
  render_domain_id: string | null;
  last_error: string | null;
  last_checked_at: string | null;
}

export interface OwnedSite {
  id: string;
  custom_domain: string | null;
}

export interface ApplyCheckInput {
  siteId: string;
  host: string;
  /** 検証開始時に読んだ verification_token。一致しなければ適用しない */
  fencingToken: string;
  status: DomainStatus;
  renderDomainId: string | null;
  lastError: string | null;
  /** true のときだけ、同じトランザクションで sites.custom_domain も更新する */
  makePrimary: boolean;
}

export type ApplyCheckResult =
  | { ok: true; switched: boolean }
  | { ok: false; reason: 'gone' | 'error'; message?: string };

export interface DomainStore {
  getOwnedSite(siteId: string, userId: string): Promise<OwnedSite | null>;
  listDomains(siteId: string): Promise<DomainRecord[]>;
  getDomain(siteId: string, host: string): Promise<DomainRecord | null>;
  addDomain(siteId: string, host: string, token: string):
    Promise<{ ok: true; row: DomainRecord } | { ok: false; reason: 'taken' | 'error'; message?: string }>;
  applyCheck(input: ApplyCheckInput): Promise<ApplyCheckResult>;
  setPrimary(siteId: string, host: string, fencingToken: string):
    Promise<{ ok: true } | { ok: false; reason: 'gone' | 'not_connected' | 'error'; message?: string }>;
  beginRelease(siteId: string, host: string):
    Promise<{ ok: true; row: DomainRecord } | { ok: false; reason: 'gone' | 'error'; message?: string }>;
  finishRelease(siteId: string, host: string, fencingToken: string):
    Promise<{ ok: boolean; message?: string }>;
  markReleaseFailed(siteId: string, host: string, message: string): Promise<void>;
}

export interface DnsPort {
  txt(name: string): Promise<string[]>;
  cname(host: string): Promise<string[]>;
  a(host: string): Promise<string[]>;
}

export interface RenderPort {
  configured(): boolean;
  /** 所有確認が取れてから呼ぶ */
  register(host: string): Promise<{ ok: true; domainId: string | null } | { ok: false; message: string }>;
  /** このサービスに登録されているドメインを名前で引く */
  find(host: string): Promise<{ ok: true; domain: { id?: string; name: string; verificationStatus?: string } | null } | { ok: false; message: string }>;
  /**
   * 解除。保存済みIDを信用せず、必ずホスト名でこのサービスの登録を引き直してから
   * そのIDで消す。行の render_domain_id を書き換えて他人のドメインを
   * 消させる経路を残さないため。
   */
  unregisterByHost(host: string): Promise<{ ok: true; removed: boolean } | { ok: false; message: string }>;
}

export interface ProbePort {
  /** そのホスト名で、実際にこのサービスへHTTPSで到達できたか */
  reachesService(host: string): Promise<boolean>;
}

export interface Deps {
  store: DomainStore;
  dns: DnsPort;
  render: RenderPort;
  probe: ProbePort;
  expectedTarget: string;
  expectedApexIps: string[];
  mainHost?: string | null;
}

// ── 結果の型 ──────────────────────────────────────────

export type ServiceError = { ok: false; status: number; error: string };

function err(status: number, error: string): ServiceError {
  return { ok: false, status, error };
}

// ── 追加 ──────────────────────────────────────────────

export async function addDomain(
  deps: Deps,
  args: { siteId: string; userId: string; input: unknown },
): Promise<ServiceError | { ok: true; host: string; status: DomainStatus }> {
  const site = await deps.store.getOwnedSite(args.siteId, args.userId);
  if (!site) return err(404, 'Not found');

  const norm = normalizeDomain(args.input);
  if (!norm.ok) return err(400, norm.error);
  const host = norm.value.host;

  if (isReservedHost(host, deps.mainHost)) return err(400, 'このドメインは使用できません');

  const added = await deps.store.addDomain(args.siteId, host, generateVerificationToken());
  if (!added.ok) {
    if (added.reason === 'taken') return err(409, 'このドメインはすでに別のサイトに設定されています');
    return err(500, added.message || '登録に失敗しました');
  }
  return { ok: true, host, status: added.row.status };
}

// ── 検証 ──────────────────────────────────────────────

export interface VerifyEvidence {
  ownership: boolean;
  dnsPointsHere: boolean;
  pointedBy: 'cname' | 'a' | null;
  reachesService: boolean;
  renderCheck: RenderCheck;
  seen: { cname: string[]; a: string[]; txtCount: number };
}

export type VerifyResult =
  | ServiceError
  | { ok: true; host: string; status: DomainStatus; switched: boolean; evidence: VerifyEvidence; lastError: string | null };

export async function verifyDomain(
  deps: Deps,
  args: { siteId: string; userId: string; host: unknown },
): Promise<VerifyResult> {
  const site = await deps.store.getOwnedSite(args.siteId, args.userId);
  if (!site) return err(404, 'Not found');

  const norm = normalizeDomain(args.host);
  if (!norm.ok) return err(400, norm.error);
  const host = norm.value.host;

  const row = await deps.store.getDomain(args.siteId, host);
  if (!row) return err(404, 'このドメインは登録されていません');
  if (row.status === 'release_pending') return err(409, 'このドメインは解除処理中です');

  // 1. 所有確認。ここが通らないと外部登録もしない。
  const txt = await deps.dns.txt(challengeRecordName(host));
  const ownership = checkOwnership(txt, row.verification_token);

  let renderCheck: RenderCheck = deps.render.configured() ? 'unavailable' : 'not_configured';
  let renderDomainId = row.render_domain_id;
  let lastError: string | null = null;

  // 2. 所有が取れてから外部登録・照会
  if (ownership && deps.render.configured()) {
    if (!renderDomainId) {
      const reg = await deps.render.register(host);
      if (reg.ok) renderDomainId = reg.domainId;
      else lastError = reg.message;
    }
    const found = await deps.render.find(host);
    if (found.ok) {
      if (found.domain) {
        renderCheck = found.domain.verificationStatus === 'verified' ? 'verified' : 'unverified';
        if (found.domain.id) renderDomainId = found.domain.id;
      } else {
        renderCheck = 'unverified';
      }
    } else {
      // 照会に失敗した＝結果が分からない。未検証と同じ扱いにはしない。
      renderCheck = 'unavailable';
      lastError = lastError ?? found.message;
    }
  }

  // 3. 公開DNS上の向き先（案内用）
  const [cname, a] = await Promise.all([deps.dns.cname(host), deps.dns.a(host)]);
  const points = checkPointsHere({ txt, cname, a }, {
    expectedTarget: deps.expectedTarget,
    expectedApexIps: deps.expectedApexIps,
  });

  // 4. 実際にこのサービスへ到達できるか（接続済みの必須条件）
  let reachesService = false;
  if (ownership) reachesService = await deps.probe.reachesService(host);

  const status = deriveStatus({ ownership, dnsPointsHere: points.pointsHere, reachesService, renderCheck });

  const evidence: VerifyEvidence = {
    ownership,
    dnsPointsHere: points.pointsHere,
    pointedBy: points.how,
    reachesService,
    renderCheck,
    seen: { cname, a, txtCount: txt.length },
  };

  // 5. 主な公開URLがまだ無いときだけ、確認できた時点で自動的に採用する。
  //    すでに別のホストで公開できている場合は勝手に移さない（明示的な切替操作を使う）。
  const makePrimary = status === 'connected' && !site.custom_domain;

  const applied = await deps.store.applyCheck({
    siteId: args.siteId,
    host,
    fencingToken: row.verification_token,
    status,
    renderDomainId,
    lastError,
    makePrimary,
  });

  if (!applied.ok) {
    // 保存できていないなら、成功として返さない。配信先も変えない。
    if (applied.reason === 'gone') {
      return err(409, 'このドメインは処理中に削除されました。もう一度追加してください');
    }
    return err(500, applied.message || '確認結果を保存できませんでした');
  }

  return { ok: true, host, status, switched: applied.switched, evidence, lastError };
}

// ── 主ドメインの切替 ──────────────────────────────────

export async function setPrimaryDomain(
  deps: Deps,
  args: { siteId: string; userId: string; host: unknown },
): Promise<ServiceError | { ok: true; host: string }> {
  const site = await deps.store.getOwnedSite(args.siteId, args.userId);
  if (!site) return err(404, 'Not found');

  const norm = normalizeDomain(args.host);
  if (!norm.ok) return err(400, norm.error);
  const host = norm.value.host;

  const row = await deps.store.getDomain(args.siteId, host);
  if (!row) return err(404, 'このドメインは登録されていません');
  if (!isServable(row.status)) {
    return err(409, '接続の確認が取れていないドメインは公開URLにできません');
  }

  const res = await deps.store.setPrimary(args.siteId, host, row.verification_token);
  if (!res.ok) {
    if (res.reason === 'gone') return err(409, 'このドメインは処理中に削除されました');
    if (res.reason === 'not_connected') return err(409, '接続の確認が取れていないドメインは公開URLにできません');
    return err(500, res.message || '切り替えに失敗しました');
  }
  return { ok: true, host };
}

// ── 解除 ──────────────────────────────────────────────

export type ReleaseResult =
  | ServiceError
  | { ok: true; host: string; released: boolean; status: DomainStatus; message?: string };

/**
 * 解除の順番:
 *   1. 配信ポインタを外し、状態を release_pending にする（ここまでは1トランザクション）
 *   2. Render側を解除する。保存済みIDは信用せず、ホスト名で引き直す
 *   3. 成功したら行を消す。失敗したら release_pending のまま残して再試行できるようにする
 *
 * 途中で失敗しても ok=true を返さない。
 */
export async function releaseDomain(
  deps: Deps,
  args: { siteId: string; userId: string; host: unknown },
): Promise<ReleaseResult> {
  const site = await deps.store.getOwnedSite(args.siteId, args.userId);
  if (!site) return err(404, 'Not found');

  const norm = normalizeDomain(args.host);
  if (!norm.ok) return err(400, norm.error);
  const host = norm.value.host;

  const begun = await deps.store.beginRelease(args.siteId, host);
  if (!begun.ok) {
    if (begun.reason === 'gone') return err(404, 'このドメインは登録されていません');
    return err(500, begun.message || '解除を開始できませんでした');
  }
  const row = begun.row;

  if (deps.render.configured()) {
    const res = await deps.render.unregisterByHost(host);
    if (!res.ok) {
      await deps.store.markReleaseFailed(args.siteId, host, res.message);
      return {
        ok: true,
        host,
        released: false,
        status: 'release_pending',
        message: `配信は停止しました。外部側の解除に失敗したため、あとで再試行できます（${res.message}）`,
      };
    }
  }

  const fin = await deps.store.finishRelease(args.siteId, host, row.verification_token);
  if (!fin.ok) {
    await deps.store.markReleaseFailed(args.siteId, host, fin.message || 'DB削除に失敗');
    return {
      ok: true,
      host,
      released: false,
      status: 'release_pending',
      message: '配信は停止しました。記録の削除に失敗したため、あとで再試行できます',
    };
  }

  return { ok: true, host, released: true, status: 'release_pending' };
}
