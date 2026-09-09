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
  type ProbeResult,
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
  /**
   * 処理の世代。解除を開始するたびにDB側で進む。
   * verification_token は行の同一性、こちらは同じ行の中での処理の新しさを表す。
   * TXTトークンだけでは、解除の途中に古い検証が割り込むのを止められなかった。
   */
  operation_epoch: number;
  /** 外部登録を呼ぶ直前に立てた印。後始末の認可に使う */
  render_register_started_at: string | null;
  /**
   * 解除を開始した時点で確定した「こちらの都合で作った外部登録があるか」。
   * 解除に入ると status が release_pending になり legacy 等の根拠が消えるので、
   * その瞬間の判断をDB側で固定している。再試行しても判断がぶれない。
   */
  external_registration_owned: boolean | null;
  /** 所有確認が一度でも通ったか */
  ownership_verified_at: string | null;
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
  /** 検証開始時に読んだ処理世代。解除が始まっていれば進んでいるので弾かれる */
  epoch: number;
  status: DomainStatus;
  renderDomainId: string | null;
  lastError: string | null;
  /** true のときだけ、同じトランザクションで sites.custom_domain も更新する */
  makePrimary: boolean;
}

export type ApplyCheckResult =
  | { ok: true; switched: boolean }
  | { ok: false; reason: 'gone' | 'releasing' | 'error'; message?: string };

export interface DomainStore {
  getOwnedSite(siteId: string, userId: string): Promise<OwnedSite | null>;
  listDomains(siteId: string): Promise<DomainRecord[]>;
  getDomain(siteId: string, host: string): Promise<DomainRecord | null>;
  addDomain(siteId: string, host: string, token: string):
    Promise<{ ok: true; row: DomainRecord } | { ok: false; reason: 'taken' | 'error'; message?: string }>;
  applyCheck(input: ApplyCheckInput): Promise<ApplyCheckResult>;
  setPrimary(siteId: string, host: string, fencingToken: string, epoch: number):
    Promise<{ ok: true } | { ok: false; reason: 'gone' | 'not_connected' | 'error'; message?: string }>;
  beginRelease(siteId: string, host: string):
    Promise<{ ok: true; row: DomainRecord } | { ok: false; reason: 'gone' | 'error'; message?: string }>;
  finishRelease(siteId: string, host: string, fencingToken: string, epoch: number):
    Promise<{ ok: boolean; message?: string }>;
  markReleaseFailed(siteId: string, host: string, epoch: number, message: string): Promise<void>;
  /** 外部登録を呼ぶ直前に印を付ける（DB保存前に落ちた登録を回収するため） */
  markRegisterStarted(siteId: string, host: string, epoch: number): Promise<void>;
  /** そのホストが代理店の管理用ドメインとして既に使われていないか */
  isAgencyAdminHost(host: string): Promise<boolean>;
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
  /**
   * そのホスト名で、実際にこのサービスへ到達できたか。
   * 署名鍵が無いなど、確認自体ができない場合は 'unavailable' を返す。
   * 固定の応答を返すだけのサーバーは 'reached' にならない。
   */
  reachesService(host: string): Promise<ProbeResult>;
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

  // 代理店の管理画面ドメインは profiles.agency_admin_domain 側で登録される別経路。
  // site_domains の重複だけを見ていると、他人の管理ホストを自分の候補として
  // 登録でき、そのまま解除に進めてしまう。
  if (await deps.store.isAgencyAdminHost(host)) {
    return err(409, 'このドメインは別の用途で使用されています');
  }

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
  probe: ProbeResult;
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
      // 外部登録が成功したのにDB保存前に落ちると、こちらの都合で作った登録が
      // 追跡できなくなる。呼ぶ「前」に印を残しておく。
      await deps.store.markRegisterStarted(args.siteId, host, row.operation_epoch);
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

  // 4. 署名付きの往復で、実際にこのサービスへ到達できるか
  let probe: ProbeResult = 'unavailable';
  if (ownership) probe = await deps.probe.reachesService(host);

  const status = deriveStatus({ ownership, dnsPointsHere: points.pointsHere, probe, renderCheck });

  const evidence: VerifyEvidence = {
    ownership,
    dnsPointsHere: points.pointsHere,
    pointedBy: points.how,
    probe,
    renderCheck,
    seen: { cname, a, txtCount: txt.length },
  };

  // 5. 主な公開URLの自動採用を「希望」として伝えるだけにする。
  //    ここで読んだ custom_domain は外部確認の前の値なので、
  //    実際に採用してよいかはDB側で「いまも未設定か」を見て決める。
  const makePrimary = status === 'connected' && !site.custom_domain;

  const applied = await deps.store.applyCheck({
    siteId: args.siteId,
    host,
    fencingToken: row.verification_token,
    epoch: row.operation_epoch,
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
    if (applied.reason === 'releasing') {
      return err(409, 'このドメインは解除処理中です。完了してからやり直してください');
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

  const res = await deps.store.setPrimary(args.siteId, host, row.verification_token, row.operation_epoch);
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
 * その行が「こちらの都合で作った外部登録」を持っているか。
 *
 * ホスト名が外部の一覧に載っていることは、削除してよい根拠にならない。
 * 同じRenderサービスには、代理店の管理用ホストや別サイトの別名も載る。
 * 削除してよいのは、サーバー側の記録が「この申請のために登録した」と
 * 示しているものだけ:
 *   - render_domain_id を保存できている（登録が完了した）
 *   - render_register_started_at がある（登録を呼んだ。保存前に落ちた分の回収）
 *   - legacy（移行時に sites.custom_domain から取り込んだ＝実際に配信していた割当）
 */
export function ownsExternalRegistration(row: DomainRecord): boolean {
  // 解除開始時にDB側で固定した判断があれば、それに従う。
  // （status は release_pending に変わってしまうので、後から再計算できない）
  if (row.external_registration_owned !== null && row.external_registration_owned !== undefined) {
    return row.external_registration_owned;
  }
  if (row.render_domain_id) return true;
  if (row.render_register_started_at) return true;
  if (row.status === 'legacy') return true;
  return false;
}

/**
 * 解除の順番:
 *   1. 配信ポインタを外し、状態を release_pending にする（ここまでは1トランザクション）
 *      このときDB側で処理世代が進むので、進行中だった検証の結果は適用されなくなる
 *   2. 外部登録の帰属を確認する。こちらが作った登録でなければ外部は触らない
 *   3. Render側を解除する。保存済みIDは信用せず、ホスト名で引き直す
 *   4. 成功したら行を消す。失敗したら release_pending のまま残して再試行できるようにする
 *
 * 途中で失敗しても ok=true（released=true）を返さない。
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

  // 所有確認も外部登録も通っていない候補は、こちらの記録に外部の登録が無い。
  // 外部には触らず、候補の取消だけにする。
  const external = ownsExternalRegistration(row);

  if (external && deps.render.configured()) {
    const res = await deps.render.unregisterByHost(host);
    if (!res.ok) {
      await deps.store.markReleaseFailed(args.siteId, host, row.operation_epoch, res.message);
      return {
        ok: true,
        host,
        released: false,
        status: 'release_pending',
        message: `配信は停止しました。外部側の解除に失敗したため、あとで再試行できます（${res.message}）`,
      };
    }
  } else if (external && !deps.render.configured()) {
    // 過去に外部登録した記録があるのに、いまは外部APIの設定が無い。
    // 「解除不要」とは扱わず、記録を残して手当てできるようにする。
    await deps.store.markReleaseFailed(
      args.siteId, host, row.operation_epoch,
      '外部APIが未設定のため解除できませんでした。設定後に再試行してください',
    );
    return {
      ok: true,
      host,
      released: false,
      status: 'release_pending',
      message: '配信は停止しました。外部側の解除は設定が戻ってから行います',
    };
  }

  const fin = await deps.store.finishRelease(args.siteId, host, row.verification_token, row.operation_epoch);
  if (!fin.ok) {
    await deps.store.markReleaseFailed(args.siteId, host, row.operation_epoch, fin.message || 'DB削除に失敗');
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
