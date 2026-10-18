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
import { HP_PLAN_PRODUCTS, isSeoPlan, laruEntitlement } from '@/lib/laru-entitlement';
import { alertLarubotFailure } from '@/lib/larubot-alert';
import { reactivateWhenReady, syncPublicationTarget, seoPublicIdOf, PT_EXCLUDED_PUBLIC_IDS, PT_EXCLUDED_SITE_IDS, type PtDeps, type PtSite } from '@/lib/publication-target-sync';

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
  /**
   * この控え（同じ event_at・plan・state）を送ったときに、LARUbot の応答で SEO の有効を確かめられたか（seoConfirmed と同じ判定）。
   * true だけが確認済み。false＝確かめられなかった（seo:false・欠落・未知の reason など）。無い＝この項目より前の控え（未確認）
   */
  seo_confirmed?: boolean;
  /** 確かめた会社（LARUbot の public_id）。紐付けが変わったら、古い確認を使い回さない */
  seo_public_id?: string | null;
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
/** 次に試す時刻。起点から 24 時間の打ち切りを越えて先へ置かない（打ち切りの判定が、未来の next_at の陰で遅れないように） */
export function nextRetryAt(now: Date, attempts: number, firstAt: string): string {
  const t = now.getTime() + RETRY_DELAYS_MS[Math.min(attempts - 1, RETRY_DELAYS_MS.length - 1)];
  const limit = Date.parse(firstAt) + GIVE_UP_MS;
  return new Date(Number.isFinite(limit) ? Math.max(now.getTime(), Math.min(t, limit)) : t).toISOString();
}

/** 1 回の定期処理で扱う件数（負荷の上限）。取り出しは期限の早い順に、これより 1 件多く読む（残りがあるかを知るため） */
export const RETRY_BATCH = 20;
/**
 * 期限の来た待ち（state/status が value の行）を、期限の早い順に取り出す。
 * next_at は toISOString（UTC・同じ桁数）で保存しているので、->> の文字列順＝時刻順。next_at なし（null）は先頭（期限到来扱い）。
 * 並べてから件数を切るので、時刻前の行が何件あっても、期限の来た行が上限の外に埋もれない。同じ時刻は id 順（安定）。
 * 起点（firstKey）から 24 時間を過ぎた行も期限到来として扱う（前の形で next_at が先にある行の打ち切りが遅れないように）。
 */
export async function selectDue(db: unknown, key: string, field: string, value: string, firstKey: string, now: Date): Promise<{ rows: SiteRow[]; more: boolean }> {
  const { data, error } = await (db as Db).from('sites').select(SITE_COLUMNS)
    .eq(`settings_json->${key}->>${field}`, value)
    .order(`settings_json->${key}->>next_at`, { ascending: true, nullsFirst: true })
    .order('id', { ascending: true })
    .limit(RETRY_BATCH + 1);
  if (error) throw new Error(`pending ${key} could not be read`);
  const due = ((data ?? []) as SiteRow[]).filter((s) => {
    const r = ((s.settings_json ?? {}) as Record<string, unknown>)[key] as Record<string, unknown> | undefined;
    if (!r || r[field] !== value) return false;
    const next = typeof r.next_at === 'string' ? Date.parse(r.next_at) : NaN;
    const first = typeof r[firstKey] === 'string' ? Date.parse(r[firstKey] as string) : NaN;
    // next_at が無い・読めない時刻は、黙って待たせず期限到来として扱う（再試行の記録で直る・24 時間で要対応）
    return !r.next_at || !Number.isFinite(next) || next <= now.getTime() || (Number.isFinite(first) && now.getTime() - first >= GIVE_UP_MS);
  });
  return { rows: due.slice(0, RETRY_BATCH), more: due.length > RETRY_BATCH };
}
/** 処理の直前に 1 行だけ読み直す。取り出したあとに更新・取消された待ちは、古い取り出し結果で進めない（null） */
async function rereadSame(db: unknown, site: SiteRow, key: string): Promise<SiteRow | null> {
  const { data, error } = await (db as Db).from('sites').select(SITE_COLUMNS).eq('id', site.id);
  const fresh = error ? undefined : (((data ?? []) as SiteRow[])[0] ?? undefined);
  if (!fresh) return null;
  const was = ((site.settings_json ?? {}) as Record<string, unknown>)[key];
  const now = ((fresh.settings_json ?? {}) as Record<string, unknown>)[key];
  return JSON.stringify(was) === JSON.stringify(now) ? fresh : null;
}
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
        // reason が無い・壊れた本文は applied と見なさない（届いたが、何が起きたかは確かめられていない）
        const result = json && typeof json.reason === 'string' ? json.reason : 'unknown';
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
  input: { plan: string; state: EntState; eventAt: string; userId: string; event: string; reactivatePt?: boolean; publicId?: string | null },
  outcome: EntOutcome,
  now: Date,
): EntRecord {
  const same = !!prev && prev.event_at === input.eventAt && prev.plan === input.plan && prev.state === input.state;
  const base = { plan: input.plan, state: input.state, event_at: input.eventAt, user_id: input.userId, event: input.event };
  const reactivate = !!(input.reactivatePt || (same && prev?.reactivate_pt));
  if (outcome.kind === 'done') {
    // 通信が終わった・控えを書けた、とは別に「SEO の有効を確かめられたか」を残す（保存後に読む経路が同じ判定を使えるように）
    return { ...base, status: 'synced', attempts: 0, first_failed_at: null, next_at: null, last_http: 200, last_code: null, result: outcome.result, reactivate_pt: false, seo_confirmed: seoConfirmed(outcome), seo_public_id: input.publicId ?? null };
  }
  if (outcome.kind === 'failed') {
    const attempts = (same ? prev!.attempts : 0) + 1;
    const firstFailed = same && prev!.first_failed_at ? prev!.first_failed_at : now.toISOString();
    const expired = !Number.isFinite(Date.parse(firstFailed)) || now.getTime() - Date.parse(firstFailed) >= GIVE_UP_MS;   // 起点が読めない時刻なら、待ち続けず打ち切る
    const pending = outcome.retryable && !expired;
    return {
      ...base, status: pending ? 'pending' : 'failed', attempts, first_failed_at: firstFailed,
      next_at: pending ? nextRetryAt(now, attempts, firstFailed) : null,
      last_http: outcome.status, last_code: outcome.code, result: null, reactivate_pt: reactivate,
    };
  }
  return { ...base, status: 'failed', attempts: 0, first_failed_at: null, next_at: null, last_http: null, last_code: `skipped:${outcome.reason}`, result: null, reactivate_pt: reactivate };
}

type Db = {
  from(t: string): {
    select(c: string): {
      eq(k: string, v: string): PromiseLike<{ data: unknown[] | null; error: unknown }> & { limit(n: number): PromiseLike<{ data: unknown[] | null; error: unknown }>; order(k: string, o: { ascending: boolean; nullsFirst?: boolean }): Ordered };
    };
    update(v: Record<string, unknown>): { eq(k: string, v: string): Filtered };
  };
};
type Ordered = { order(k: string, o: { ascending: boolean; nullsFirst?: boolean }): Ordered; limit(n: number): PromiseLike<{ data: unknown[] | null; error: unknown }> };
type Filtered = { eq(k: string, v: string): Filtered; select(c: string): PromiseLike<{ data: unknown[] | null; error: unknown }> };
type SiteRow = PtSite & { user_id: string; published?: boolean };
const SITE_COLUMNS = 'id, user_id, slug, custom_domain, published, settings_json';

/**
 * 控えを書く。設定（settings_json）は編集画面と同じ列なので、読んだときのままの行にだけ書く（updated_at で確かめる。
 * 編集画面の settings_json_patch と同じ方式）。間に保存が入ったら読み直してやり直す。編集中の設定を古い読み取りで巻き戻さない。
 */
async function saveRecord(db: unknown, siteId: string, record: EntRecord): Promise<boolean> {
  return saveSettingKey(db, siteId, ENT_KEY, record, (current) => !!current && Date.parse((current as EntRecord).event_at) > Date.parse(record.event_at));
}

/**
 * サーバーだけが持つ項目を 1 つ書く（updated_at が読んだときのままの行にだけ。間に保存が入れば読み直す）。
 * skip(current) が true なら書かずに成功とする（もっと新しい状態が先にある、など）。
 */
async function saveSettingKey(db: unknown, siteId: string, key: string, value: unknown, skip?: (current: unknown) => boolean): Promise<boolean> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const fresh = await (db as Db).from('sites').select('settings_json, updated_at').eq('id', siteId);
    const row = (fresh.data ?? [])[0] as { settings_json?: Record<string, unknown>; updated_at?: string } | undefined;
    if (fresh.error || !row) return false;
    if (skip && skip(row.settings_json?.[key] ?? null)) return true;
    let q = (db as Db).from('sites').update({ settings_json: { ...(row.settings_json ?? {}), [key]: value } }).eq('id', siteId);
    if (row.updated_at) q = q.eq('updated_at', row.updated_at);
    const saved = await q.select('id');
    if (saved.error) return false;
    if ((saved.data ?? []).length === 1) return true;
  }
  return false;
}

/**
 * SEO を戻してよいと LARUbot が確かめたか（2026-10-18）。
 * stale は「古いイベントを受け付けなかった」という返事で、その古いイベントの SEO が今も有効という証拠ではない。
 * 返ってきた最終状態（entitlement.seo）が false のときも戻さない。
 */
export function seoConfirmed(outcome: EntOutcome): boolean {
  // 成功と定義された reason（applied / duplicate）で、最終状態の seo が true と明示されているときだけ。
  // 欠落・null・文字列・未知の reason・200 だけ・空や壊れた本文は「確かめられなかった」（2026-10-18）
  return outcome.kind === 'done' && (outcome.result === 'applied' || outcome.result === 'duplicate')
    && !!outcome.entitlement && typeof outcome.entitlement === 'object' && outcome.entitlement.seo === true;
}

/** 届いたが SEO の有効を確かめられなかった（stale・seo:false＝無効の確認、とは分ける） */
export function seoUnknown(outcome: EntOutcome): boolean {
  if (outcome.kind !== 'done' || seoConfirmed(outcome) || outcome.result === 'stale') return false;
  return !(outcome.entitlement && typeof outcome.entitlement === 'object' && outcome.entitlement.seo === false);
}

/** 確認済みの権利のあとで、公開先を戻す（持ち主のいまの SEO を読み直す）。結果は復帰待ちとして残す */
export async function reactivateConfirmed(db: unknown, site: SiteRow, ctx: { userId: string; event: string; eventAt: string | null }, deps: EntDeps = {}): Promise<RecoveryRecord | null> {
  if (!site.published) return null;
  const { ownerLaruEntitlement } = await import('@/lib/hp-owner-entitlement');
  const ownerSeo = (await ownerLaruEntitlement(db as Parameters<typeof ownerLaruEntitlement>[0], ctx.userId)).seo;
  if (!ownerSeo) return null;
  const outcome = await reactivateWhenReady(site, { event: ctx.event, ownerSeo }, deps);
  const prior = (((site.settings_json ?? {}) as Record<string, unknown>)[RECOVERY_KEY] as RecoveryRecord | undefined) ?? null;
  const prev = prior && prior.state === 'pending' && prior.event_at === ctx.eventAt ? prior : null;
  return noteReactivation(db, site, { ...ctx, prev, prior }, outcome, deps);
}

/** 控えから、その会社の HP 由来の SEO が確認済みか（同じプランのままの支払い回復など、今回は送らない経路で使う） */
/**
 * 保存された控えが、その会社（publicId）の SEO 有効の確認になっているか。
 * confirmed＝送ったときに LARUbot が seo:true と答えた（seoConfirmed）。
 * legacy＝確認の印を持たない前の形の控え（推測で true にしない。必要なら読み取り専用の status で確かめる）。
 * unconfirmed＝それ以外（確かめられなかった・別の会社・SEO なし・失敗中）。
 */
export function recordSeoEvidence(record: EntRecord | null | undefined, publicId: string | null | undefined): 'confirmed' | 'legacy' | 'unconfirmed' {
  if (!record || record.status !== 'synced' || record.state !== 'active' || !isSeoPlan(record.plan)) return 'unconfirmed';
  if (record.result !== 'applied' && record.result !== 'duplicate') return 'unconfirmed';
  if (!('seo_confirmed' in record) || record.seo_confirmed === undefined) return 'legacy';
  if (record.seo_confirmed !== true) return 'unconfirmed';
  return !!publicId && record.seo_public_id === publicId ? 'confirmed' : 'unconfirmed';
}
export function recordConfirmsSeo(record: EntRecord | null | undefined, publicId: string | null | undefined): boolean {
  return recordSeoEvidence(record, publicId) === 'confirmed';
}

/* ── 公開先の復帰待ち（2026-10-18）────────────────────────────────────────────
  権利の同期が済んでも、記事一覧がまだ 200 でない（反映待ち・一時的な 503）と、公開先の reactivate は見送られる。
  以前はそこで終わり、本人が再公開するまで戻らなかった。権利の控え（synced）とは別の項目に「復帰待ち」を残し、
  同じ 5 分ごとの再送が拾う。権利 API は呼び直さない。event_at は元の時刻のまま、試行・次の時刻・起点は別に持つ。
  再開の前に、いまの状態（公開中・同じ紐付け・持ち主の SEO・新しい控え）を読み直し、変わっていれば中止する。 */
export const RECOVERY_KEY = 'larubotPublicationRecovery';
export interface RecoveryRecord {
  public_id: string;
  /** 公開先（publication-target）が使う ID。会社の ID と別に控え、どちらかが変われば中止する */
  pt_public_id?: string;
  user_id: string;
  event: string;
  event_at: string | null;
  state: 'pending' | 'done' | 'needs_attention' | 'cancelled';
  attempts: number;
  first_at: string;
  next_at: string | null;
  last_reason: string | null;
  last_http: number | null;
}
type ReactivateOutcome = Awaited<ReturnType<typeof reactivateWhenReady>>;
/** 公開先ではなく、こちら側の読み取りが一時的に失敗したもの（復帰待ちの記録の理由名） */
const READ_FAILURES = new Set(['owner_unreadable', 'state_unknown', 'status_unreachable']);

/** reactivate の結果を、復帰待ちとして残す（done／再試行待ち／要対応／中止）。成功したのに記録できなくても、再実行は冪等 */
export async function noteReactivation(
  db: unknown,
  site: SiteRow,
  ctx: { userId: string; event: string; eventAt: string | null; prev?: RecoveryRecord | null; prior?: RecoveryRecord | null },
  outcome: ReactivateOutcome | { kind: 'unconfirmed' },
  deps: EntDeps = {},
): Promise<RecoveryRecord | null> {
  const now = (deps.now ?? (() => new Date()))();
  const publicId = companyPublicId(site.settings_json) ?? '';
  const prev = ctx.prev ?? null;          // 同じイベントの復帰待ち（続き）
  const prior = ctx.prior ?? prev;        // いま残っている復帰待ち（別のイベントのものも含む）
  const base = { public_id: publicId, pt_public_id: seoPublicIdOf(site), user_id: ctx.userId, event: ctx.event, event_at: ctx.eventAt, first_at: prev?.first_at ?? now.toISOString() };
  let next: RecoveryRecord | null = null;
  if (outcome.kind === 'done') {
    // 一度で戻り、残っている復帰待ちも無いものは記録しない。古い復帰待ち・要対応が残っていれば、戻ったと書き換える
    if (!prior || prior.state === 'done') return null;
    next = { ...base, state: 'done', attempts: prev?.attempts ?? 0, next_at: null, last_reason: null, last_http: 200 };
  } else if (outcome.kind === 'unconfirmed') {
    next = { ...base, state: 'needs_attention', attempts: 0, next_at: null, last_reason: 'entitlement_unconfirmed', last_http: null };
  } else if (outcome.kind === 'skipped' && outcome.reason !== 'not_ready') {
    if (!prior || prior.state !== 'pending') return null;   // 対象外（除外・紐付けなし・契約に SEO なし・鍵なし）：待たない
    next = { ...base, state: 'cancelled', attempts: prev?.attempts ?? 0, next_at: null, last_reason: outcome.reason, last_http: null };
  } else {
    const retryable = outcome.kind === 'skipped' || outcome.retryable;
    const attempts = (prev?.attempts ?? 0) + 1;
    const expired = !Number.isFinite(Date.parse(base.first_at)) || now.getTime() - Date.parse(base.first_at) >= GIVE_UP_MS;
    const reason = outcome.kind === 'skipped' ? 'articles_not_ready' : READ_FAILURES.has(outcome.code ?? '') ? String(outcome.code) : `publication_target_${outcome.code ?? outcome.status ?? 'unreachable'}`;
    const pending = retryable && !expired;
    next = {
      ...base, state: pending ? 'pending' : 'needs_attention', attempts,
      next_at: pending ? nextRetryAt(now, attempts, base.first_at) : null,
      last_reason: reason, last_http: outcome.kind === 'failed' ? outcome.status : null,
    };
  }
  const saved = await saveRecovery(db, site.id, next, prev);
  console.info(`[publication-recovery] ${JSON.stringify({ site_id: site.id, public_id: publicId, event: ctx.event, event_at: ctx.eventAt, state: next.state, attempts: next.attempts, reason: next.last_reason, http: next.last_http, saved })}`);
  if (next.state === 'needs_attention' && saved) {
    await alertLarubotFailure({
      kind: 'publication_recovery', userId: ctx.userId, plan: null, siteId: site.id,
      reason: next.last_reason === 'entitlement_unconfirmed' ? 'LARUbot の応答で SEO の有効を確かめられなかったため、公開先を戻していません' : `公開先を戻せていません（${next.last_reason}）`,
      dedupe: `${ctx.eventAt ?? '-'}|${next.last_reason}`,
    });
  }
  return next;
}

/**
 * 復帰待ちを書く。続き（prev）を書くときは、いま残っているものが同じイベントの pending のときだけ
 * （間に新しいイベントの復帰待ちが書かれた・別の処理が先に終えた、なら上書きしない）。
 * 新しく書くときは、もっと新しいイベントの復帰待ちを古いもので上書きしない。
 */
async function saveRecovery(db: unknown, siteId: string, next: RecoveryRecord, prev: RecoveryRecord | null): Promise<boolean> {
  const t = (v: string | null | undefined) => (v ? Date.parse(v) : -Infinity);
  return saveSettingKey(db, siteId, RECOVERY_KEY, next, (current) => {
    const c = current as RecoveryRecord | null;
    if (!c) return false;
    if (prev) return !(c.state === 'pending' && c.event_at === prev.event_at && c.first_at === prev.first_at);
    return t(c.event_at) > t(next.event_at);
  });
}

/** 同じ会社（public_id）の控えのうち、いちばん新しいもの（控えは会社ごとに 1 サイトにしか無いことがある） */
async function latestRecordFor(db: unknown, userId: string, publicId: string): Promise<EntRecord | null | undefined> {
  const { data, error } = await (db as Db).from('sites').select(SITE_COLUMNS).eq('user_id', userId);
  if (error) return undefined;   // 読めない＝分からない
  let latest: EntRecord | null = null;
  for (const row of (data ?? []) as SiteRow[]) {
    if (companyPublicId(row.settings_json) !== publicId) continue;
    const r = ((row.settings_json ?? {}) as Record<string, unknown>)[ENT_KEY] as EntRecord | undefined;
    if (r && (!latest || Date.parse(r.event_at) > Date.parse(latest.event_at))) latest = r;
  }
  return latest;
}

/**
 * いま、そのサイトの公開先を戻してよいか。
 * stop＝はっきり変わった（非公開・紐付けの変更・SEO 解除・新しい控え）→ 中止。
 * unknown＝読めなかった（DB・LARUbot の一時的な失敗）→ 変わったとは扱わない（待ちのまま再試行。戻したあとなら取り消さない）。
 */
type StopCheck = { stop: string } | { unknown: string } | null;
async function recoveryStopReason(db: unknown, site: SiteRow, r: RecoveryRecord, deps: EntDeps): Promise<StopCheck> {
  const settings = (site.settings_json ?? {}) as Record<string, unknown>;
  if (!site.published) return { stop: 'unpublished' };
  if (site.user_id !== r.user_id || companyPublicId(settings) !== r.public_id || (r.pt_public_id && seoPublicIdOf(site) !== r.pt_public_id)) return { stop: 'link_changed' };
  // 持ち主の契約。読めないときに「SEO なし」と決めない（ownerLaruEntitlement は読めないと false を返すため、先に自分で読む）
  const prof = await (db as Db).from('profiles').select('plan, subscription_status').eq('id', r.user_id);
  if (prof.error) return { unknown: 'owner_unreadable' };
  const p = (((prof.data ?? []) as unknown[])[0] ?? {}) as { plan?: string | null; subscription_status?: string | null };
  if (!laruEntitlement(p.plan ?? null, p.subscription_status ?? null).seo) {
    const { ownerLaruEntitlement } = await import('@/lib/hp-owner-entitlement');
    if (!(await ownerLaruEntitlement(db as Parameters<typeof ownerLaruEntitlement>[0], r.user_id)).seo) return { stop: 'seo_off' };
  }
  const latest = await latestRecordFor(db, r.user_id, r.public_id);
  if (latest === undefined) return { unknown: 'state_unknown' };
  const evidence = latest ? recordSeoEvidence(latest, r.public_id) : null;
  if (evidence === 'unconfirmed') return { stop: 'entitlement_changed' };
  // 控えが無い・前の形の控え（確認の印なし）は、読み取り専用の status で確かめる
  if (evidence !== 'confirmed') {
    const st = await statusHpSeo(r.public_id, deps);
    if (st === null) return { unknown: 'status_unreachable' };
    if (!st) return { stop: 'entitlement_unconfirmed' };
  }
  return null;
}

/**
 * 控えが無い会社だけ、LARUbot の status（読むだけ）で HP 由来の SEO が有効かを確かめる（直接契約の SEO とは分ける）。
 * true＝hp.state active かつ hp.seo true。false＝そうでないと読めた（4xx を含む）。null＝読めなかった（通信・5xx・壊れた応答）
 */
export async function statusHpSeo(publicId: string, deps: EntDeps = {}): Promise<boolean | null> {
  const secret = process.env.LARU_HP_API_SECRET;
  if (!secret || !publicId) return false;
  try {
    const res = await (deps.fetch ?? fetch)(`${apiBase()}/api/hp/status?public_id=${encodeURIComponent(publicId)}`, { headers: { 'x-laru-secret': secret }, cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.status >= 500) return null;
    if (!res.ok) return false;
    const json = (await res.json().catch(() => undefined)) as { entitlement?: { hp?: { state?: unknown; seo?: unknown } | null } } | null | undefined;
    if (json === undefined || json === null || typeof json !== 'object') return null;
    const hp = json.entitlement?.hp;
    return !!hp && hp.state === 'active' && hp.seo === true;
  } catch {
    return null;
  }
}
export async function statusConfirmsHpSeo(publicId: string, deps: EntDeps = {}): Promise<boolean> {
  return (await statusHpSeo(publicId, deps)) === true;
}

/** 復帰待ちの再開（server.js から 5 分ごと。権利の再送と同じ口）。いまの状態を読み直し、変わっていれば中止する */
export async function retryPendingRecoveries(db: unknown, deps: EntDeps = {}): Promise<{ due: number; more: boolean; done: number; pending: number; cancelled: number; attention: number }> {
  const now = (deps.now ?? (() => new Date()))();
  const { rows, more } = await selectDue(db, RECOVERY_KEY, 'state', 'pending', 'first_at', now);
  // due＝今回扱う件数（全体の件数ではない）。more＝期限の来た待ちがまだ残っている（次の周期で続き）
  const counts = { due: rows.length, more, done: 0, pending: 0, cancelled: 0, attention: 0 };
  const log = (o: Record<string, unknown>) => console.info(`[publication-recovery] ${JSON.stringify(o)}`);
  for (const picked of rows) {
    const site = await rereadSame(db, picked, RECOVERY_KEY);
    if (!site) { log({ site_id: picked.id, skipped: 'changed_since_pick' }); continue; }
    const r = ((site.settings_json ?? {}) as Record<string, unknown>)[RECOVERY_KEY] as RecoveryRecord;
    const ctx = { userId: r.user_id, event: r.event, eventAt: r.event_at, prev: r };
    const check = await recoveryStopReason(db, site, r, deps);
    let note: RecoveryRecord | null;
    if (check && 'stop' in check) {
      note = { ...r, state: 'cancelled', next_at: null, last_reason: check.stop };
      const saved = await saveRecovery(db, site.id, note, r);
      log({ site_id: site.id, event_at: r.event_at, state: 'cancelled', reason: check.stop, saved });
    } else if (check) {
      // 読めなかった：待ちのまま（有限。24 時間で要対応・通知）
      note = await noteReactivation(db, site, ctx, { kind: 'failed', retryable: true, status: null, code: check.unknown, attempts: 0, safeForRemoval: false }, deps);
    } else {
      const outcome = await reactivateWhenReady(site, { event: `${r.event}:recovery`, ownerSeo: true }, deps);
      if (outcome.kind === 'done') {
        // 戻したあとで、もう一度確かめる。待っている間に SEO 解除・非公開・削除が重なっていたら、戻した相手（site＝戻したときの紐付け）をすぐ止め直す
        const read = await (db as Db).from('sites').select(SITE_COLUMNS).eq('id', site.id);
        const fresh = read.error ? undefined : (((read.data ?? []) as SiteRow[])[0] ?? null);
        const after: StopCheck = fresh === undefined ? { unknown: 'site_unreadable' } : fresh === null ? { stop: 'deleted' } : await recoveryStopReason(db, fresh, r, deps);
        if (after && 'stop' in after) {
          const reason = after.stop === 'unpublished' ? 'site_unpublished' : after.stop === 'deleted' ? 'site_deleted' : after.stop === 'link_changed' ? 'other' : 'seo_disabled';
          const undo = await syncPublicationTarget(site, 'deactivate', { event: `${r.event}:recovery_undo`, ownerSeo: true, reason }, deps);
          const undone = undo.kind !== 'failed';
          note = { ...r, state: undone ? 'cancelled' : 'needs_attention', next_at: null, last_reason: `${after.stop}_after_reactivate${undone ? '' : '_undo_failed'}`, last_http: undo.kind === 'failed' ? undo.status : r.last_http };
          const saved = fresh ? await saveRecovery(db, site.id, note, r) : false;
          log({ site_id: site.id, event_at: r.event_at, state: note.state, reason: note.last_reason, saved });
          if (!undone) {
            await alertLarubotFailure({
              kind: 'publication_recovery', userId: r.user_id, plan: null, siteId: site.id,
              reason: `公開先を戻した直後に${after.stop === 'unpublished' ? '非公開' : after.stop === 'deleted' ? '削除' : after.stop === 'link_changed' ? '紐付けの変更' : 'SEO の解除'}が分かりましたが、止め直せていません`,
              dedupe: `${r.event_at ?? '-'}|${note.last_reason}`,
            });
          }
        } else {
          // 読めなかった（after が unknown）ときは、取り消さない：直前の確認では戻してよかったため
          if (after) log({ site_id: site.id, event_at: r.event_at, post_check: after.unknown });
          note = await noteReactivation(db, site, ctx, outcome, deps);
        }
      } else note = await noteReactivation(db, site, ctx, outcome, deps);
    }
    const st = note?.state;
    if (st === 'done') counts.done++; else if (st === 'pending') counts.pending++; else if (st === 'cancelled') counts.cancelled++; else counts.attention++;
  }
  return counts;
}

async function alertEntitlement(record: EntRecord, siteId: string, outcome: EntOutcome) {
  if (outcome.kind === 'done') return;
  await alertLarubotFailure({
    kind: 'entitlement', userId: record.user_id, plan: record.plan, siteId,
    dedupe: `${record.state}|${record.event_at}|send|${outcome.kind === 'failed' ? (outcome.retryable ? 'gave_up' : `code_${outcome.code ?? '-'}`) : outcome.reason}`,
    reason: outcome.kind === 'failed'
      ? (outcome.retryable ? `${record.state} event_at=${record.event_at}（24時間再送しても届かず）` : `${record.state} event_at=${record.event_at} code=${outcome.code ?? '-'}（再送しても変わらないため停止）`)
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
  const rec = { plan: plan ?? String(input.plan), state: input.state, eventAt: input.eventAt, userId, event: input.event, reactivatePt: input.reactivatePt, publicId };
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
  if (!saved) {
    // 控えが無いと再送も照合もできない。同期済みと見せず、運営へ知らせる
    console.error('[hp-entitlement] 控えを保存できませんでした', JSON.stringify({ site_id: site.id, state: input.state, event_at: input.eventAt, status: record.status }));
    await alertLarubotFailure({ kind: 'entitlement_record', userId, plan: record.plan, siteId: site.id, dedupe: `${record.state}|${record.event_at}|record`, reason: `${record.state} event_at=${record.event_at} の控えを保存できません` });
  }
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
    await alertLarubotFailure({ kind: 'entitlement', userId, plan: input.plan, siteId: null, dedupe: `${input.state}|${input.eventAt}|sites`, reason: `${input.state} event_at=${input.eventAt} サイトを読めず送れませんでした` });
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
    await alertLarubotFailure({ kind: 'entitlement', userId: site.user_id, plan: input.plan, siteId: site.id, dedupe: `site_deleted|code_${outcome.code ?? '-'}`, reason: `site_deleted code=${outcome.code ?? '-'}`, status: outcome.status });
  }
  return true;
}

/**
 * 再送（server.js から 5 分ごと）。控えが pending で next_at を過ぎたものだけ、控えた event_at のまま送り直す。
 * 成功して reactivate_pt が付いていれば、公開先を reactivate する（SEO の再追加・再契約）。
 */
export async function retryPendingEntitlements(db: unknown, deps: EntDeps = {}): Promise<{ due: number; more: boolean; done: number; pending: number; failed: number }> {
  const now = (deps.now ?? (() => new Date()))();
  const { rows, more } = await selectDue(db, ENT_KEY, 'status', 'pending', 'first_failed_at', now);
  const counts = { due: rows.length, more, done: 0, pending: 0, failed: 0 };
  for (const picked of rows) {
    const site = await rereadSame(db, picked, ENT_KEY);
    if (!site) continue;   // 取り出したあとに控えが変わった（新しいイベント・別の処理が送った）
    const r = ((site.settings_json ?? {}) as Record<string, unknown>)[ENT_KEY] as EntRecord;
    const outcome = await syncSiteEntitlement(db, site, { plan: r.plan, state: r.state, eventAt: r.event_at, event: r.event, userId: r.user_id, reactivatePt: r.reactivate_pt }, deps);
    if (outcome.kind === 'done') {
      counts.done++;
      if (r.reactivate_pt && r.state === 'active' && isSeoPlan(r.plan) && site.published) {
        if (seoConfirmed(outcome)) await reactivateConfirmed(db, site, { userId: r.user_id, event: `${r.event}:retry`, eventAt: r.event_at }, deps);
        else if (seoUnknown(outcome)) await noteReactivation(db, site, { userId: r.user_id, event: r.event, eventAt: r.event_at }, { kind: 'unconfirmed' }, deps);
      }
    } else if (outcome.kind === 'failed' && outcome.retryable) counts.pending++;
    else if (outcome.kind === 'skipped' && outcome.reason === 'no_public_id') {
      // 待っている間に紐付けが外れた：送れないまま期限到来の先頭に居続けないよう、送らずに終わったと残す（運営テストサイトは控えを書かない）
      await saveRecord(db, site.id, nextRecord(r, { plan: r.plan, state: r.state, eventAt: r.event_at, userId: r.user_id, event: r.event }, outcome, now));
      counts.failed++;
    }
    else counts.failed++;
  }
  return counts;
}
