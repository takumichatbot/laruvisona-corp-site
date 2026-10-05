/**
 * LARU SEO の「記事の正規の公開先（Publication Target）」を、LARU HP の公開ライフサイクルに合わせる（M03 クローズ）。
 *
 * 仕様（正）: LARUbot_homepage `docs/integrations/laru_hp_publication_target_lifecycle.md`（e953113）
 *   POST {LARU}/api/hp/seo/publication-target   ヘッダー x-laru-secret（LARU_HP_API_SECRET・既存の鍵）
 *   body: public_id, site_id, action（register / deactivate / retire）, canonical_base・article_path（register）, reason（deactivate / retire）
 *   全 action 冪等。未登録への deactivate / retire は 200（changed:false）。
 *   失敗: 401 鍵の設定ミス／400 HP 側のバグ／404 public_id なし／409 契約・紐付けの不一致 → 再試行しない（運営へ）
 *         5xx・タイムアウト → 再試行してよい（指数バックオフで 3 回）
 *
 * 順番（ここがいちばん大事）
 *   ・記事ページが 200 を返すようになってから register（公開・再公開・独自ドメインの追加／変更）
 *   ・記事ページが消える前に deactivate / retire（非公開・SEO 解除・解約・削除）。失敗したら消す処理を保留する
 *     （LARU 側の旧入口が 404 の HP へ 301 し続ける時間を作らない）
 *
 * 呼ぶのは、LARU SEO の public_id があり、持ち主の契約に LARU SEO が含まれるサイトだけ（記事ページを出す条件と同じ判定を使う）。
 * 運営の一時テストサイトは呼ばない（除外）。記事・public_id・枠・プラン・Stripe には触らない。
 */
import { blogPublicId } from '@/lib/larubot-public-id';
import { canonicalBase } from '@/lib/public-site-url';
import { HP_ARTICLE_PATH, listUrl } from '@/lib/hp-seo-content';
import { isSeoPlan, laruEntitlement } from '@/lib/laru-entitlement';

export type PtAction = 'register' | 'deactivate' | 'retire' | 'reactivate';
export type PtReason = 'site_unpublished' | 'seo_disabled' | 'domain_unavailable' | 'other' | 'plan_cancelled' | 'site_deleted';
export interface PtSite { id: string; slug: string | null; custom_domain: string | null; settings_json?: unknown }

/** 運営の一時テストサイト（登録しない） */
export const PT_EXCLUDED_PUBLIC_IDS = new Set(['f509753a-e62f-46e1-927e-d721dd934d1f']);
export const PT_EXCLUDED_SITE_IDS = new Set(['3a99d73a-e676-4b25-b6e6-6bb7e52706ba']);

export type SyncOutcome =
  | { kind: 'skipped'; reason: 'no_public_id' | 'excluded' | 'not_entitled' | 'not_configured' | 'not_ready'; safeForRemoval: true }
  | { kind: 'done'; changed: boolean | null; redirectsToHp: boolean | null; state: string | null; attempts: number; safeForRemoval: true }
  | { kind: 'failed'; status: number | null; code: string | null; retryable: boolean; attempts: number; safeForRemoval: boolean };

export interface PtDeps {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  log?: (level: 'info' | 'error', line: Record<string, unknown>) => void;
}

const BACKOFF_MS = [300, 900, 2700];   // 5xx・タイムアウトだけ、3 回まで再試行
const TIMEOUT_MS = 8000;
const apiBase = () => (process.env.LARUBOT_API_URL || 'https://larubot.tokyo').replace(/\/+$/, '');
const defaultLog: NonNullable<PtDeps['log']> = (level, line) => {
  const text = `[publication-target] ${JSON.stringify(line)}`;
  if (level === 'error') console.error(text); else console.info(text);
};

export function seoPublicIdOf(site: PtSite): string {
  return blogPublicId((site.settings_json ?? {}) as { laruseoPublicId?: string; larubotPublicId?: string });
}

/** 呼んでよいサイトか（public_id あり・除外でない・持ち主の契約に LARU SEO・設定で切っていない） */
export function ptEligibility(site: PtSite, ownerSeo: boolean): Extract<SyncOutcome, { kind: 'skipped' }> | null {
  const publicId = seoPublicIdOf(site);
  if (!publicId) return { kind: 'skipped', reason: 'no_public_id', safeForRemoval: true };
  if (PT_EXCLUDED_PUBLIC_IDS.has(publicId) || PT_EXCLUDED_SITE_IDS.has(site.id)) return { kind: 'skipped', reason: 'excluded', safeForRemoval: true };
  const settings = (site.settings_json ?? {}) as Record<string, unknown>;
  if (!ownerSeo || settings.laruseo === false) return { kind: 'skipped', reason: 'not_entitled', safeForRemoval: true };
  return null;
}

/**
 * 消す前の呼び出し（deactivate / retire）で、消してよいか。
 *   成功・404（public_id が無い）・409（SEO 無効・HP バンドルでない・未登録・別サイトに紐付き）
 *   → この公開先へは 301 していない（仕様の 301 policy: active かつ HP バンドルで SEO 有効のときだけ 301）
 *   401（鍵）・400（こちらのバグ）・5xx を再試行し尽くした → 状態が分からないので保留
 */
const removalSafeStatus = (status: number) => status === 404 || status === 409;

/** 共通の呼び出し口（1 か所）。例外は投げない。秘密・個人情報は記録しない */
export async function syncPublicationTarget(
  site: PtSite,
  action: PtAction,
  opts: { event: string; ownerSeo: boolean; reason?: PtReason; canonicalBase?: string },
  deps: PtDeps = {},
): Promise<SyncOutcome> {
  const log = deps.log ?? defaultLog;
  const publicId = seoPublicIdOf(site);
  const base = { event: opts.event, site_id: site.id, public_id: publicId || null, action };
  const skip = ptEligibility(site, opts.ownerSeo);
  if (skip) {
    if (skip.reason !== 'no_public_id') log('info', { ...base, final: `skipped:${skip.reason}` });
    return skip;
  }
  const secret = process.env.LARU_HP_API_SECRET;
  if (!secret) {
    // 鍵が無い HP からは登録もできない＝LARU 側から HP への 301 は作られていない
    log('error', { ...base, final: 'skipped:not_configured' });
    return { kind: 'skipped', reason: 'not_configured', safeForRemoval: true };
  }
  const body: Record<string, unknown> = { public_id: publicId, site_id: site.id, action };
  if (action === 'register') {
    body.canonical_base = (opts.canonicalBase ?? canonicalBase(site)).replace(/\/+$/, '');
    body.article_path = HP_ARTICLE_PATH;
  } else if (action === 'reactivate') {
    // 控えた値ではなく、いまの公開 URL で戻す（止めている間に独自ドメインが変わっていても古い base へ 301 しない）
    body.canonical_base = (opts.canonicalBase ?? canonicalBase(site)).replace(/\/+$/, '');
  } else if (opts.reason) body.reason = opts.reason;

  const doFetch = deps.fetch ?? fetch;
  const sleep = deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  let attempts = 0;
  let last: { status: number | null; code: string | null } = { status: null, code: null };
  for (;;) {
    attempts++;
    try {
      const res = await doFetch(`${apiBase()}/api/hp/seo/publication-target`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-laru-secret': secret },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: 'no-store',
      });
      const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (res.ok && json?.ok !== false) {
        const reg = (json?.registration ?? {}) as Record<string, unknown>;
        const out: SyncOutcome = {
          kind: 'done',
          changed: typeof json?.changed === 'boolean' ? json.changed : null,
          redirectsToHp: typeof reg.redirects_to_hp === 'boolean' ? reg.redirects_to_hp : null,
          state: typeof reg.state === 'string' ? reg.state : null,
          attempts,
          safeForRemoval: true,
        };
        log('info', { ...base, ...(opts.reason ? { reason: opts.reason } : {}), status: res.status, attempts, changed: out.changed, state: out.state, redirects_to_hp: out.redirectsToHp, final: 'done' });
        return out;
      }
      last = { status: res.status, code: typeof json?.code === 'string' ? json.code : typeof json?.error === 'string' ? json.error : null };
      if (res.status < 500) break;   // 4xx は再試行しない
    } catch {
      last = { status: null, code: 'unreachable' };
    }
    if (attempts > BACKOFF_MS.length) break;
    await sleep(BACKOFF_MS[attempts - 1]);
  }
  const retryable = last.status === null || last.status >= 500;
  const safeForRemoval = action !== 'register' && last.status !== null && removalSafeStatus(last.status);
  log('error', { ...base, ...(opts.reason ? { reason: opts.reason } : {}), status: last.status, code: last.code, retryable, attempts, final: safeForRemoval ? 'failed:safe_to_remove' : 'failed' });
  return { kind: 'failed', status: last.status, code: last.code, retryable, attempts, safeForRemoval };
}

/** その記事一覧が、いま 200 を返すか（register の前に必ず確かめる） */
export async function articlesReady(site: PtSite, base: string, deps: PtDeps = {}): Promise<boolean> {
  // 手元の確認だけ、同じサーバーのパス形式で確かめる（本番は正規 URL そのもの）
  const origin = process.env.HP_ARTICLES_READY_ORIGIN;
  const url = origin && site.slug ? `${origin.replace(/\/+$/, '')}/hp/${encodeURIComponent(site.slug)}/articles` : listUrl(base);
  try {
    const res = await (deps.fetch ?? fetch)(url, { method: 'GET', redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS) });
    return res.status === 200;
  } catch {
    return false;
  }
}

/** 記事ページが 200 になってから register。準備できていなければ登録しない（LARU 側が正規のまま＝安全） */
export async function registerWhenReady(
  site: PtSite,
  opts: { event: string; ownerSeo: boolean; canonicalBase?: string },
  deps: PtDeps = {},
): Promise<SyncOutcome> {
  const skip = ptEligibility(site, opts.ownerSeo);
  if (skip) return syncPublicationTarget(site, 'register', opts, deps);
  const base = (opts.canonicalBase ?? canonicalBase(site)).replace(/\/+$/, '');
  if (!(await articlesReady(site, base, deps))) {
    (deps.log ?? defaultLog)('error', { event: opts.event, site_id: site.id, public_id: seoPublicIdOf(site), action: 'register', final: 'skipped:not_ready', retryable: true });
    return { kind: 'skipped', reason: 'not_ready', safeForRemoval: true };
  }
  return syncPublicationTarget(site, 'register', { ...opts, canonicalBase: base }, deps);
}

/**
 * SEO の再追加・再契約のあと：記事ページが 200 なのを確かめてから reactivate（いまの canonical_base で戻す）。
 * 一度も登録していない公開先（409 not_registered）は register で作る。LARUbot 側は公開先を自動では戻さない。
 */
export async function reactivateWhenReady(
  site: PtSite,
  opts: { event: string; ownerSeo: boolean },
  deps: PtDeps = {},
): Promise<SyncOutcome> {
  const skip = ptEligibility(site, opts.ownerSeo);
  if (skip) return syncPublicationTarget(site, 'reactivate', opts, deps);
  const base = canonicalBase(site).replace(/\/+$/, '');
  if (!(await articlesReady(site, base, deps))) {
    (deps.log ?? defaultLog)('error', { event: opts.event, site_id: site.id, public_id: seoPublicIdOf(site), action: 'reactivate', final: 'skipped:not_ready', retryable: true });
    return { kind: 'skipped', reason: 'not_ready', safeForRemoval: true };
  }
  const r = await syncPublicationTarget(site, 'reactivate', { ...opts, canonicalBase: base }, deps);
  if (r.kind === 'failed' && r.status === 409 && r.code === 'not_registered') {
    return syncPublicationTarget(site, 'register', { ...opts, canonicalBase: base }, deps);
  }
  return r;
}

/** 持ち主のサイト（公開ライフサイクルの判定に要る列だけ） */
export async function ownerSites(db: unknown, userId: string): Promise<(PtSite & { published: boolean })[] | null> {
  type Q = { from(t: 'sites'): { select(c: string): { eq(k: 'user_id', v: string): PromiseLike<{ data: unknown[] | null; error: unknown }> } } };
  const { data, error } = await (db as Q).from('sites').select('id, slug, custom_domain, published, settings_json').eq('user_id', userId);
  if (error) return null;
  return (data ?? []) as (PtSite & { published: boolean })[];
}

/**
 * 契約の変化（プラン変更・支払いの失敗/回復・解約）に合わせる。
 *   LARU SEO が外れる → 変更を書き込む前に deactivate（seo_disabled）。1 つでも保留なら false（呼ぶ側は書き込みを保留）
 *   解約 → 変更を書き込む前に retire（plan_cancelled）
 *   LARU SEO が付く → 書き込んだあとに、公開中のサイトを記事ページの 200 を確かめてから register
 */
export async function beforeOwnerSeoLoss(db: unknown, userId: string, mode: 'downgrade' | 'cancel', event: string, deps: PtDeps = {}): Promise<boolean> {
  const sites = await ownerSites(db, userId);
  if (!sites) return false;
  let ok = true;
  for (const site of sites) {
    const r = await syncPublicationTarget(site, mode === 'cancel' ? 'retire' : 'deactivate', {
      event, ownerSeo: true, reason: mode === 'cancel' ? 'plan_cancelled' : 'seo_disabled',
    }, deps);
    if (!r.safeForRemoval) ok = false;
  }
  return ok;
}

export async function afterOwnerSeoGain(db: unknown, userId: string, event: string, deps: PtDeps = {}): Promise<void> {
  const sites = await ownerSites(db, userId);
  for (const site of sites ?? []) {
    if (site.published) await reactivateWhenReady(site, { event, ownerSeo: true }, deps);
  }
}

/* ── 契約の変化のときの判定（既存のプラン判定 laruEntitlement をそのまま使う。判定を増やさない） ── */
type Billing = { plan: string | null | undefined; status: string | null | undefined };
export const seoActive = (b: Billing) => laruEntitlement(b.plan, b.status).seo;

/**
 * プラン・契約状態が変わる「前」に呼ぶ。LARU SEO が外れるなら deactivate（seo_disabled）。
 * 戻り値 false は「保留」：呼ぶ側はプランの書き込み（と Stripe への変更）を行わず、エラーを返す。
 */
export async function beforeBillingChange(db: unknown, userId: string, from: Billing, to: Billing, event: string, deps: PtDeps = {}): Promise<boolean> {
  if (!(seoActive(from) && !seoActive(to))) return true;
  return beforeOwnerSeoLoss(db, userId, 'downgrade', event, deps);
}
/**
 * プラン・契約状態が変わった「後」に呼ぶ。
 *   1. HP バンドルの権利が変わったなら、LARUbot へ「いまの権利」を送る（lib/hp-entitlement-sync.ts。eventAt＝HP 側でその状態になった時刻）
 *   2. LARU SEO が付いたなら、1 が成功してから、公開中のサイトの記事ページを確かめて公開先を reactivate
 *      （1 が再送待ちになったら、再送が成功したときに reactivate する）
 * eventAt が無い呼び出しでは権利を送らない（時刻を作らない）。
 */
export async function afterBillingChange(db: unknown, userId: string, from: Billing, to: Billing, event: string, deps: PtDeps & { eventAt?: string } = {}): Promise<void> {
  const seoGain = !seoActive(from) && seoActive(to);
  let deferred = false;
  const { entitlementChange, syncUserEntitlement } = await import('@/lib/hp-entitlement-sync');
  const change = entitlementChange(from, to);
  if (change && deps.eventAt) {
    const sent = await syncUserEntitlement(db, userId, { ...change, eventAt: deps.eventAt, event, reactivatePt: seoGain }, deps);
    deferred = sent.some((r) => r.outcome.kind === 'failed');
  }
  if (seoGain && !deferred) await afterOwnerSeoGain(db, userId, event, deps);
}
/**
 * 解約の前に呼ぶ。LARU SEO を含むプランだった人だけ retire（plan_cancelled）。false は保留。
 * 公開先を止められたら、LARUbot へ cancelled（HP 由来の Bot・SEO をゼロに）を送る。送れなくても解約は止めない（再送待ち）。
 * eventAt＝契約が実際に終わった時刻。解約予約（期間末で終わる設定）だけではここへ来ない。
 */
export async function beforeCancel(db: unknown, userId: string, plan: string | null | undefined, event: string, deps: PtDeps & { eventAt?: string } = {}): Promise<boolean> {
  const ok = isSeoPlan(plan) ? await beforeOwnerSeoLoss(db, userId, 'cancel', event, deps) : true;
  if (ok && deps.eventAt) {
    const { entitlementPlan, syncUserEntitlement } = await import('@/lib/hp-entitlement-sync');
    await syncUserEntitlement(db, userId, { plan: entitlementPlan(plan) ?? 'hp', state: 'cancelled', eventAt: deps.eventAt, event }, deps);
  }
  return ok;
}

/* ── 独自ドメイン（同じ hp_site_id のまま canonical base を更新） ── */
type OwnedSite = PtSite & { published: boolean; user_id: string };
async function loadOwnedSite(userId: string, siteId: string): Promise<OwnedSite | null> {
  const { createServiceClient } = await import('@/lib/supabase/server');
  const { data } = await createServiceClient().from('sites')
    .select('id, slug, custom_domain, published, settings_json, user_id').eq('id', siteId).eq('user_id', userId).maybeSingle();
  return (data as OwnedSite | null) ?? null;
}
async function ownerSeoOf(userId: string): Promise<boolean> {
  const [{ createServiceClient }, { ownerLaruEntitlement }] = await Promise.all([import('@/lib/supabase/server'), import('@/lib/hp-owner-entitlement')]);
  return (await ownerLaruEntitlement(createServiceClient(), userId)).seo;
}

/** 独自ドメインの追加・切替のあと：新しい base で記事ページが 200 になってから register（失敗しても切替は止めない） */
export async function afterDomainChange(userId: string, siteId: string, event: string, deps: PtDeps = {}): Promise<SyncOutcome | null> {
  const site = await loadOwnedSite(userId, siteId);
  if (!site?.published) return null;
  return registerWhenReady(site, { event, ownerSeo: await ownerSeoOf(userId) }, deps);
}

/**
 * 主な公開URL（独自ドメイン）を外す前：外したあとの base（パス形式）で記事ページが 200 なのを確かめ、先に register する。
 * 外したあとの旧ドメインは配信しないので、先に切り替えないと LARU 側の旧入口が配信されないホストへ 301 する。
 * 切り替えられなかったら false（解除を保留）。
 */
export async function beforePrimaryDomainRelease(userId: string, siteId: string, host: string | null, deps: PtDeps = {}): Promise<boolean> {
  const site = await loadOwnedSite(userId, siteId);
  const h = (host || '').trim().toLowerCase().replace(/\.$/, '');
  if (!site?.published || !h || (site.custom_domain || '').toLowerCase() !== h) return true;
  const ownerSeo = await ownerSeoOf(userId);
  if (ptEligibility(site, ownerSeo)) return true;
  const r = await registerWhenReady({ ...site, custom_domain: null }, { event: 'domain_released', ownerSeo }, deps);
  if (r.kind === 'done') return true;
  if (r.kind === 'skipped') return r.reason !== 'not_ready';
  return r.status !== null && removalSafeStatus(r.status);
}
