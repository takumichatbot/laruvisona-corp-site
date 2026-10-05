/**
 * LARU HP バンドルの権利を LARUbot へ同期する（「いまの権利」を丸ごと送る。差分ではない）。
 *
 * 仕様（正）: LARUbot_homepage `docs/integrations/laru_hp_bundle_entitlement_lifecycle.md`（LARUbot 49d8d8f で本番反映）
 *   POST {LARU}/api/hp/entitlement   ヘッダー x-laru-secret（register と同じ LARU_HP_API_SECRET）
 *   body: public_id, site_id, user_id, plan, state（active / cancelled / site_deleted）, event_at
 *   200: reason = applied / duplicate（同じ時刻・同じ内容）/ stale（保存済みより古い）。どれも正常。
 *        同じ時刻で内容が違うときは applied（LARUbot app/services/hp_entitlement.py apply_event）。
 *   4xx: 再送しても変わらない → 記録して運営へ。5xx・通信エラー: 指数バックオフで再送（最大 24 時間）。
 *
 * event_at は「HP 側でその状態になった時刻」。送信時刻ではない。決めたら控えに残し、再送でも同じ値を送る。
 *   Stripe の通知 … そのイベントの時刻（解約は契約が実際に終わった時刻 ended_at）
 *   画面・管理画面のプラン変更 … Stripe の変更が確定した時刻
 *   定期同期での補正・サイト作成時の紐付け … HP 側の記録をその状態に直した時刻
 *   分からないときは送らない（時刻を作らない）。
 *
 * plan は LARU HP のプラン ID をそのまま送る（仕様の表と一致を確認済み 2026-10-05）。
 *   hp → なし／lite → LARUbot lite／hp-bot → starter（HP では Standard）／hp-bot-seo → starter + SEO／agency → lite + SEO
 *   Bot Lite と Standard を名前で同じ値にしない（lite と hp-bot は別）。
 *
 * 失敗しても決済・プラン変更は止めない。控え（sites.settings_json.larubotEntitlement）に再送待ちとして残し、
 * server.js の 5 分ごとの再送（/api/cron/hp-entitlement-retry）が送り直す。
 * 鍵・認証ヘッダ・個人情報（メール等）はログに出さない。
 */
import { HP_PLAN_PRODUCTS, isSeoPlan } from '@/lib/laru-entitlement';
import { alertLarubotFailure } from '@/lib/larubot-alert';
import { reactivateWhenReady, PT_EXCLUDED_PUBLIC_IDS, PT_EXCLUDED_SITE_IDS, type PtDeps, type PtSite } from '@/lib/publication-target-sync';

export type EntState = 'active' | 'cancelled' | 'site_deleted';
export const ENT_KEY = 'larubotEntitlement';

/** 控え（サイトごと。いちばん新しい状態だけを持つ） */
export interface EntRecord {
  plan: string;
  state: EntState;
  event_at: string;
  user_id: string;
  event: string;
  status: 'pending' | 'synced' | 'failed';
  attempts: number;
  first_failed_at: string | null;
  next_at: string | null;
  last_http: number | null;
  last_code: string | null;
  result: string | null;
  /** SEO の再追加・再契約で、同期が成功したら公開先を reactivate する */
  reactivate_pt?: boolean;
}

export type EntOutcome =
  | { kind: 'done'; result: string; entitlement: Record<string, unknown> | null; attempts: number }
  | { kind: 'failed'; status: number | null; code: string | null; retryable: boolean; attempts: number }
  | { kind: 'skipped'; reason: 'no_public_id' | 'invalid_plan' | 'not_configured' | 'newer_recorded' | 'already_synced' | 'no_event_at' | 'excluded' };

export interface EntDeps extends PtDeps { now?: () => Date }

const INLINE_BACKOFF_MS = [300, 900, 2700];
/** 控えに残したあとの再送間隔（仕様の例: 1分 → 5分 → 30分 → 2時間 …、最大 24 時間） */
export const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 3600_000, 6 * 3600_000, 12 * 3600_000];
export const GIVE_UP_MS = 24 * 3600_000;
const TIMEOUT_MS = 10_000;
const PUBLIC_ID = /^[A-Za-z0-9_-]{1,64}$/;
const apiBase = () => (process.env.LARUBOT_API_URL || 'https://larubot.tokyo').replace(/\/+$/, '');
const defaultLog: NonNullable<PtDeps['log']> = (level, line) => {
  const text = `[hp-entitlement] ${JSON.stringify(line)}`;
  if (level === 'error') console.error(text); else console.info(text);
};

/** 送ってよい plan（LARU HP のプラン ID）。知らない値は送らない */
export function entitlementPlan(plan: string | null | undefined): string | null {
  return plan && Object.prototype.hasOwnProperty.call(HP_PLAN_PRODUCTS, plan) ? plan : null;
}

/** LARUbot の会社の public_id（register の応答で受け取った値。チャットと SEO で同じ） */
export function companyPublicId(settings: unknown): string | null {
  const s = (settings ?? {}) as Record<string, unknown>;
  for (const v of [s.larubotPublicId, s.laruseoPublicId]) if (typeof v === 'string' && PUBLIC_ID.test(v)) return v;
  return null;
}

/** 運営の一時テストサイト（M03 の除外の正本をそのまま使う）。どの出来事でも送らない・控えも書かない */
export function isExcludedTestSite(siteId: string | null | undefined, publicId: string | null | undefined): boolean {
  return (!!siteId && PT_EXCLUDED_SITE_IDS.has(siteId)) || (!!publicId && PT_EXCLUDED_PUBLIC_IDS.has(publicId));
}

/** HP の契約が続いている（past_due は Stripe が再請求中＝解約ではない。止めない） */
const live = (status: string | null | undefined) => status === 'active' || status === 'trialing' || status === 'past_due';

/**
 * 契約の変化から、送るべき「いまの権利」。送らなくてよいときは null。
 *   ・解約は beforeCancel（契約が実際に終わったとき）で送る。ここでは送らない（解約予約・支払い遅延で止めない）
 *   ・同じプランのまま契約が続いているなら送らない（支払いの失敗→回復など）
 */
export function entitlementChange(
  from: { plan: string | null | undefined; status: string | null | undefined },
  to: { plan: string | null | undefined; status: string | null | undefined },
): { plan: string; state: 'active' } | null {
  const plan = entitlementPlan(to.plan);
  if (!plan || !live(to.status)) return null;
  if (live(from.status) && from.plan === to.plan) return null;
  return { plan, state: 'active' };
}

/** 1 回分の送信（その場の再試行つき：5xx・通信エラーだけ 3 回まで） */
export async function postEntitlement(
  input: { publicId: string; siteId: string; userId: string; plan: string; state: EntState; eventAt: string; event: string },
  deps: EntDeps = {},
): Promise<EntOutcome> {
  const log = deps.log ?? defaultLog;
  const base = { event: input.event, site_id: input.siteId, public_id: input.publicId, plan: input.plan, state: input.state, event_at: input.eventAt };
  // すべての送信がここを通る（契約の変化・解約・サイト削除・再送・運営の初回同期）。一時テストサイトはここで止める
  if (isExcludedTestSite(input.siteId, input.publicId)) {
    log('info', { ...base, final: 'skipped:excluded' });
    return { kind: 'skipped', reason: 'excluded' };
  }
  const secret = process.env.LARU_HP_API_SECRET;
  if (!secret) {
    log('error', { ...base, final: 'skipped:not_configured' });
    return { kind: 'skipped', reason: 'not_configured' };
  }
  const doFetch = deps.fetch ?? fetch;
  const sleep = deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  let attempts = 0;
  let last: { status: number | null; code: string | null } = { status: null, code: null };
  for (;;) {
    attempts++;
    try {
      const res = await doFetch(`${apiBase()}/api/hp/entitlement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-laru-secret': secret },
        body: JSON.stringify({ public_id: input.publicId, site_id: input.siteId, user_id: input.userId, plan: input.plan, state: input.state, event_at: input.eventAt }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: 'no-store',
      });
      const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (res.ok && json?.ok !== false) {
        const result = typeof json?.reason === 'string' ? json.reason : 'applied';
        const ent = (json?.entitlement ?? null) as Record<string, unknown> | null;
        log('info', { ...base, status: res.status, attempts, result, bot: ent?.bot ?? null, seo: ent?.seo ?? null, final: 'done' });
        return { kind: 'done', result, entitlement: ent, attempts };
      }
      last = { status: res.status, code: typeof json?.code === 'string' ? json.code : typeof json?.error === 'string' ? json.error : null };
      if (res.status < 500) break;
    } catch {
      last = { status: null, code: 'unreachable' };
    }
    if (attempts > INLINE_BACKOFF_MS.length) break;
    await sleep(INLINE_BACKOFF_MS[attempts - 1]);
  }
  const retryable = last.status === null || last.status >= 500;
  log('error', { ...base, status: last.status, code: last.code, retryable, attempts, final: 'failed' });
  return { kind: 'failed', status: last.status, code: last.code, retryable, attempts };
}

/** 送った結果から、次の控え。再送待ちの間隔・24 時間であきらめるのもここで決める */
export function nextRecord(
  prev: EntRecord | null,
  input: { plan: string; state: EntState; eventAt: string; userId: string; event: string; reactivatePt?: boolean },
  outcome: EntOutcome,
  now: Date,
): EntRecord {
  const same = !!prev && prev.event_at === input.eventAt && prev.plan === input.plan && prev.state === input.state;
  const base = { plan: input.plan, state: input.state, event_at: input.eventAt, user_id: input.userId, event: input.event };
  const reactivate = !!(input.reactivatePt || (same && prev?.reactivate_pt));
  if (outcome.kind === 'done') {
    return { ...base, status: 'synced', attempts: 0, first_failed_at: null, next_at: null, last_http: 200, last_code: null, result: outcome.result, reactivate_pt: false };
  }
  if (outcome.kind === 'failed') {
    const attempts = (same ? prev!.attempts : 0) + 1;
    const firstFailed = same && prev!.first_failed_at ? prev!.first_failed_at : now.toISOString();
    const expired = now.getTime() - Date.parse(firstFailed) >= GIVE_UP_MS;
    const pending = outcome.retryable && !expired;
    return {
      ...base, status: pending ? 'pending' : 'failed', attempts, first_failed_at: firstFailed,
      next_at: pending ? new Date(now.getTime() + RETRY_DELAYS_MS[Math.min(attempts - 1, RETRY_DELAYS_MS.length - 1)]).toISOString() : null,
      last_http: outcome.status, last_code: outcome.code, result: null, reactivate_pt: reactivate,
    };
  }
  return { ...base, status: 'failed', attempts: 0, first_failed_at: null, next_at: null, last_http: null, last_code: `skipped:${outcome.reason}`, result: null, reactivate_pt: reactivate };
}

type Db = {
  from(t: string): {
    select(c: string): {
      eq(k: string, v: string): PromiseLike<{ data: unknown[] | null; error: unknown }> & { limit(n: number): PromiseLike<{ data: unknown[] | null; error: unknown }> };
    };
    update(v: Record<string, unknown>): { eq(k: string, v: string): { select(c: string): PromiseLike<{ data: unknown[] | null; error: unknown }> } };
  };
};
type SiteRow = PtSite & { user_id: string; published?: boolean };
const SITE_COLUMNS = 'id, user_id, slug, custom_domain, published, settings_json';

async function saveRecord(db: unknown, siteId: string, record: EntRecord): Promise<boolean> {
  const fresh = await (db as Db).from('sites').select('settings_json').eq('id', siteId);
  const row = (fresh.data ?? [])[0] as { settings_json?: Record<string, unknown> } | undefined;
  if (fresh.error || !row) return false;
  const current = (row.settings_json?.[ENT_KEY] ?? null) as EntRecord | null;
  // もっと新しい状態が先に控えてあれば、古いほうで上書きしない（順序の逆転）
  if (current && Date.parse(current.event_at) > Date.parse(record.event_at)) return true;
  const saved = await (db as Db).from('sites').update({ settings_json: { ...(row.settings_json ?? {}), [ENT_KEY]: record } }).eq('id', siteId).select('id');
  return !saved.error && (saved.data ?? []).length === 1;
}

async function alertEntitlement(record: EntRecord, siteId: string, outcome: EntOutcome) {
  if (outcome.kind === 'done') return;
  await alertLarubotFailure({
    kind: 'entitlement', userId: record.user_id, plan: record.plan, siteId,
    reason: outcome.kind === 'failed'
      ? `${record.state} event_at=${record.event_at} code=${outcome.code ?? '-'}${outcome.retryable ? '（24時間再送しても届かず）' : '（再送しても変わらないため停止）'}`
      : `${record.state} ${outcome.reason}`,
    status: outcome.kind === 'failed' ? outcome.status : null,
  });
}

/**
 * 1 サイト（＝1 つの LARUbot 会社）へ送り、控えを残す。
 * 4xx・あきらめた失敗は運営へ。再送待ちは控えに next_at を付けるだけ（決済・プラン変更は止めない）。
 */
export async function syncSiteEntitlement(
  db: unknown,
  site: SiteRow,
  input: { plan: string; state: EntState; eventAt: string; event: string; userId?: string; reactivatePt?: boolean },
  deps: EntDeps = {},
): Promise<EntOutcome> {
  const publicId = companyPublicId(site.settings_json);
  if (!publicId) return { kind: 'skipped', reason: 'no_public_id' };
  if (isExcludedTestSite(site.id, publicId)) return { kind: 'skipped', reason: 'excluded' };
  const now = (deps.now ?? (() => new Date()))();
  const userId = input.userId ?? site.user_id;
  const prev = ((site.settings_json ?? {}) as Record<string, unknown>)[ENT_KEY] as EntRecord | undefined;
  const plan = entitlementPlan(input.plan);
  const rec = { plan: plan ?? String(input.plan), state: input.state, eventAt: input.eventAt, userId, event: input.event, reactivatePt: input.reactivatePt };
  if (!plan) {
    const out: EntOutcome = { kind: 'skipped', reason: 'invalid_plan' };
    const record = nextRecord(prev ?? null, rec, out, now);
    await saveRecord(db, site.id, record);
    await alertEntitlement(record, site.id, out);
    return out;
  }
  if (prev && Date.parse(prev.event_at) > Date.parse(input.eventAt)) return { kind: 'skipped', reason: 'newer_recorded' };
  if (prev && prev.status === 'synced' && prev.event_at === input.eventAt && prev.plan === plan && prev.state === input.state) {
    return { kind: 'skipped', reason: 'already_synced' };
  }
  const outcome = await postEntitlement({ publicId, siteId: site.id, userId, plan, state: input.state, eventAt: input.eventAt, event: input.event }, deps);
  const record = nextRecord(prev ?? null, rec, outcome, now);
  if (outcome.kind === 'skipped' && outcome.reason === 'not_configured') return outcome;   // 鍵の無い環境（手元）では控えない
  const saved = await saveRecord(db, site.id, record);
  if (!saved) console.error('[hp-entitlement] 控えを保存できませんでした', JSON.stringify({ site_id: site.id, state: input.state, event_at: input.eventAt }));
  if (record.status === 'failed') await alertEntitlement(record, site.id, outcome);
  return outcome;
}

/** 持ち主の全サイトのうち、LARUbot の会社に紐付いたもの（同じ public_id は 1 回だけ） */
export async function companySites(db: unknown, userId: string): Promise<SiteRow[] | null> {
  const { data, error } = await (db as Db).from('sites').select(SITE_COLUMNS).eq('user_id', userId);
  if (error) return null;
  const seen = new Set<string>();
  const out: SiteRow[] = [];
  for (const row of (data ?? []) as SiteRow[]) {
    const id = companyPublicId(row.settings_json);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(row);
  }
  return out;
}

export async function syncUserEntitlement(
  db: unknown,
  userId: string,
  input: { plan: string; state: EntState; eventAt: string; event: string; reactivatePt?: boolean },
  deps: EntDeps = {},
): Promise<{ site: SiteRow; outcome: EntOutcome }[]> {
  const sites = await companySites(db, userId);
  if (!sites) {
    await alertLarubotFailure({ kind: 'entitlement', userId, plan: input.plan, siteId: null, reason: `${input.state} event_at=${input.eventAt} サイトを読めず送れませんでした` });
    return [];
  }
  const out: { site: SiteRow; outcome: EntOutcome }[] = [];
  for (const site of sites) out.push({ site, outcome: await syncSiteEntitlement(db, site, { ...input, userId }, deps) });
  return out;
}

/**
 * サイト削除の前。その場で送る（削除後は控えを置く場所が無い）。
 * 5xx・通信エラーで届かなかったときだけ false（削除を保留）。4xx は運営へ知らせて進める。
 */
export async function entitlementBeforeSiteDelete(db: unknown, site: SiteRow, plan: string | null | undefined, deps: EntDeps = {}): Promise<boolean> {
  const publicId = companyPublicId(site.settings_json);
  if (!publicId) return true;
  const eventAt = (deps.now ?? (() => new Date()))().toISOString();
  const input = { publicId, siteId: site.id, userId: site.user_id, plan: entitlementPlan(plan) ?? 'hp', state: 'site_deleted' as const, eventAt, event: 'site_deleted' };
  const outcome = await postEntitlement(input, deps);
  if (outcome.kind === 'failed') {
    if (outcome.retryable) return false;
    await alertLarubotFailure({ kind: 'entitlement', userId: site.user_id, plan: input.plan, siteId: site.id, reason: `site_deleted code=${outcome.code ?? '-'}`, status: outcome.status });
  }
  return true;
}

/**
 * 再送（server.js から 5 分ごと）。控えが pending で next_at を過ぎたものだけ、控えた event_at のまま送り直す。
 * 成功して reactivate_pt が付いていれば、公開先を reactivate する（SEO の再追加・再契約）。
 */
export async function retryPendingEntitlements(db: unknown, deps: EntDeps = {}): Promise<{ due: number; done: number; pending: number; failed: number }> {
  const now = (deps.now ?? (() => new Date()))();
  const q = (db as Db).from('sites').select(SITE_COLUMNS).eq(`settings_json->${ENT_KEY}->>status`, 'pending');
  const { data, error } = await q.limit(50);
  if (error) throw new Error('pending entitlements could not be read');
  const due = ((data ?? []) as SiteRow[]).filter((s) => {
    const r = ((s.settings_json ?? {}) as Record<string, unknown>)[ENT_KEY] as EntRecord | undefined;
    return r && r.status === 'pending' && (!r.next_at || Date.parse(r.next_at) <= now.getTime());
  });
  const counts = { due: due.length, done: 0, pending: 0, failed: 0 };
  for (const site of due.slice(0, 20)) {
    const r = ((site.settings_json ?? {}) as Record<string, unknown>)[ENT_KEY] as EntRecord;
    const outcome = await syncSiteEntitlement(db, site, { plan: r.plan, state: r.state, eventAt: r.event_at, event: r.event, userId: r.user_id, reactivatePt: r.reactivate_pt }, deps);
    if (outcome.kind === 'done') {
      counts.done++;
      if (r.reactivate_pt && r.state === 'active' && isSeoPlan(r.plan) && site.published) {
        const { ownerLaruEntitlement } = await import('@/lib/hp-owner-entitlement');
        const ownerSeo = (await ownerLaruEntitlement(db as Parameters<typeof ownerLaruEntitlement>[0], r.user_id)).seo;
        await reactivateWhenReady(site, { event: `${r.event}:retry`, ownerSeo }, deps);
      }
    } else if (outcome.kind === 'failed' && outcome.retryable) counts.pending++;
    else counts.failed++;
  }
  return counts;
}
