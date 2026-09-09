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
  /** 進行中の解除処理の識別子。外部削除はこの処理に紐づけて認可する */
  release_operation_id: string | null;
  release_lease_until: string | null;
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
    Promise<{ ok: true; row: DomainRecord } | { ok: false; reason: 'gone' | 'in_progress' | 'error'; message?: string }>;
  /** 外部削除の対象IDを、この解除処理に固定する */
  pinReleaseTarget(siteId: string, host: string, epoch: number, operationId: string, renderDomainId: string):
    Promise<{ ok: true; renderDomainId: string | null } | { ok: false; reason: 'gone' | 'stale' | 'error'; message?: string }>;
  /** 外部削除の直前に、まだこの処理が有効かを確かめて占有を延長する */
  claimRelease(siteId: string, host: string, epoch: number, operationId: string):
    Promise<{ ok: true; renderDomainId: string | null } | { ok: false; reason: 'gone' | 'stale' | 'error'; message?: string }>;
  /** 外部登録は通ったが記録できなかった分を、帰属付きで積む */
  enqueueOrphanRegistration(
    siteId: string, host: string, renderDomainId: string,
    fencingToken: string, epoch: number, message: string,
  ): Promise<void>;
  finishRelease(siteId: string, host: string, fencingToken: string, epoch: number):
    Promise<{ ok: boolean; message?: string }>;
  markReleaseFailed(siteId: string, host: string, epoch: number, message: string): Promise<void>;
  /**
   * 外部登録を呼ぶ直前に印を付ける。
   * 記録できなければ外部登録を呼んではいけないので、結果を返す。
   */
  markRegisterStarted(siteId: string, host: string, fencingToken: string, epoch: number):
    Promise<{ ok: true } | { ok: false; reason: 'gone' | 'stale' | 'releasing' | 'error'; message?: string }>;
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
   * ホスト名で、このサービスに登録されているものを引く。
   * 名前が完全一致したものだけを返す。
   */
  findByHost(host: string): Promise<{ ok: true; domainId: string | null } | { ok: false; message: string }>;
  /**
   * 外部登録の削除。
   * ここではホスト名から引き直さない。呼び出し側が、その解除処理に
   * 固定したIDだけを渡す。ホストから引き直すと、遅れて再開した古い解除が
   * 別の処理で作り直された新しい登録を消してしまう。
   */
  unregisterById(domainId: string): Promise<{ ok: true; removed: boolean } | { ok: false; message: string }>;
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
  /** この呼び出しで新しく作った外部登録のID。保存に失敗したら回収へ回す */
  let registeredNow: string | null = null;

  // 2. 所有が取れてから外部登録・照会
  if (ownership && deps.render.configured()) {
    if (!renderDomainId) {
      // 外部登録が成功したのにDB保存前に落ちると、こちらの都合で作った登録が
      // 追跡できなくなる。呼ぶ「前」に印を残す。
      // 記録できなかったときは外部登録を呼ばない（記録なしの副作用を作らない）。
      const started = await deps.store.markRegisterStarted(
        args.siteId, host, row.verification_token, row.operation_epoch,
      );
      if (!started.ok) {
        lastError = started.reason === 'releasing'
          ? 'このドメインは解除処理中です'
          : '登録の記録に失敗したため、外部登録を行いませんでした';
      } else {
        const reg = await deps.render.register(host);
        if (reg.ok) {
          renderDomainId = reg.domainId;
          registeredNow = reg.domainId;
        } else {
          lastError = reg.message;
        }
      }
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
    // 外部登録は通ったのに、その記録を残せなかった場合。
    // ホスト名だけでは後から他用途の登録と区別できないので、
    // 行の同一性・世代・IDを添えて回収へ回す。
    if (registeredNow) {
      await deps.store.enqueueOrphanRegistration(
        args.siteId, host, registeredNow, row.verification_token, row.operation_epoch,
        `検証結果を保存できなかった（${applied.reason}）`,
      );
    }
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
    if (begun.reason === 'in_progress') {
      // 同じホストの解除が動いている。並行して外部へ出ていくと、
      // 遅れた側が新しい世代の登録を消しに行く。1本に集約する。
      return err(409, 'このドメインは解除処理中です。しばらくしてからお試しください');
    }
    return err(500, begun.message || '解除を開始できませんでした');
  }
  const row = begun.row;
  const epoch = row.operation_epoch;
  const opId = row.release_operation_id;

  // 所有確認も外部登録も通っていない候補は、こちらの記録に外部の登録が無い。
  // 外部には触らず、候補の取消だけにする。
  const external = ownsExternalRegistration(row);

  if (external && deps.render.configured()) {
    if (!opId) {
      await deps.store.markReleaseFailed(args.siteId, host, epoch, '解除処理の識別子を取得できませんでした');
      return { ok: true, host, released: false, status: 'release_pending',
        message: '配信は停止しました。外部側の解除はあとで再試行できます' };
    }

    // 1. 削除するIDをこの解除処理に固定する。
    //    行にIDが無い（legacy・登録途中）ときだけ外部一覧から引く。
    //    引いた結果は必ずDBに固定し、固定できなければ外部は触らない。
    let targetId = row.render_domain_id;
    if (!targetId) {
      const found = await deps.render.findByHost(host);
      if (!found.ok) {
        await deps.store.markReleaseFailed(args.siteId, host, epoch, found.message);
        return { ok: true, host, released: false, status: 'release_pending',
          message: `配信は停止しました。外部側の解除に失敗したため、あとで再試行できます（${found.message}）` };
      }
      if (found.domainId) {
        const pinned = await deps.store.pinReleaseTarget(args.siteId, host, epoch, opId, found.domainId);
        if (!pinned.ok) {
          // 引いている間に状況が変わった（別の処理が完了した・作り直された）。
          // ここで消すと、新しい世代の登録を消すことになる。
          return err(409, 'このドメインは処理中に状態が変わりました。もう一度お試しください');
        }
        targetId = pinned.renderDomainId;
      }
    }

    if (targetId) {
      // 2. 消す直前に、この解除処理がまだ有効かを確かめる。
      //    行が消えていれば（別の解除が完了していれば）ここで止まる。
      const claim = await deps.store.claimRelease(args.siteId, host, epoch, opId);
      if (!claim.ok) {
        return err(409, 'このドメインは処理中に状態が変わりました。もう一度お試しください');
      }
      // 3. 固定したIDだけを消す。ホスト名から引き直さない。
      const res = await deps.render.unregisterById(targetId);
      if (!res.ok) {
        await deps.store.markReleaseFailed(args.siteId, host, epoch, res.message);
        return {
          ok: true,
          host,
          released: false,
          status: 'release_pending',
          message: `配信は停止しました。外部側の解除に失敗したため、あとで再試行できます（${res.message}）`,
        };
      }
    }
  } else if (external && !deps.render.configured()) {
    // 過去に外部登録した記録があるのに、いまは外部APIの設定が無い。
    // 「解除不要」とは扱わず、記録を残して手当てできるようにする。
    await deps.store.markReleaseFailed(
      args.siteId, host, epoch,
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

  const fin = await deps.store.finishRelease(args.siteId, host, row.verification_token, epoch);
  if (!fin.ok) {
    await deps.store.markReleaseFailed(args.siteId, host, epoch, fin.message || 'DB削除に失敗');
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
