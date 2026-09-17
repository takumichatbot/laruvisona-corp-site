/**
 * StripeとDB（profiles）の食い違いを直すための、判断だけを書いた場所。
 *
 * なぜ要るか。
 *   契約状態（profiles.plan / subscription_status）を書いているのは
 *   Stripeのwebhookだけである。webhookが1回落ちる、あるいは再送が
 *   期限切れになると、Stripeでは課金され続けているのにDBでは未契約、
 *   という状態が永久に残る。その人はダッシュボードで公開できず、
 *   契約し直そうとしても「既存の契約が見つかりました」で弾かれる。
 *   つまり、お金だけ取って何も使えない人ができる。
 *
 *   逆向きの取りこぼしもある。Stripeで解約・失効したのにDBが active の
 *   ままなら、無料で使い続けられる。
 *
 * ここではStripeを正とする。判断を副作用から切り離してあるので、
 * Stripeにも DBにも触らずに試験できる。
 */
import { subscriptionPeriodEnd } from './stripe-shape';

/** Stripeの契約状態 → profiles.subscription_status（DBのcheck制約に収まる値）。 */
const STATUS_MAP: Record<string, string> = {
  active: 'active',
  trialing: 'trialing',
  past_due: 'past_due',
  // Stripeが集金を諦めた状態。DBに 'unpaid' は無いので、
  // 「有効ではないが解約でもない」を表す past_due に寄せる。
  unpaid: 'past_due',
  canceled: 'canceled',
  incomplete: 'inactive',
  incomplete_expired: 'inactive',
  paused: 'inactive',
};

/** もう課金されることのない状態。古い契約の残骸はこれで見分ける。 */
export const TERMINAL_STRIPE_STATUSES = ['canceled', 'incomplete_expired'];

export type StripeSubscriptionLike = {
  id: string;
  status: string;
  start_date?: number | null;
  /** 古い版の形。いまの版では items の中にある（lib/stripe-shape.ts が両方を見る） */
  current_period_end?: number | null;
  items?: { data?: Array<{ current_period_end?: number | null; current_period_start?: number | null }> } | null;
  metadata?: Record<string, string> | null;
  customer?: string | { id?: string } | null;
};

export type ProfileBilling = {
  id: string;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  subscription_status?: string | null;
  plan?: string | null;
  contract_starts_at?: string | null;
  contract_ends_at?: string | null;
  admin_notes?: string | null;
};

/**
 * 無償で使ってもらっている行の目印。`admin_notes` の先頭に入れる。
 *
 * なぜ要るか。
 * 運営の動作確認用アカウントや、無償で提供している相手は、Stripeに契約が無いまま
 * `active` になっている。定期の突き合わせは「Stripeに契約が無い active」を
 * 契約切れとみなして止めるので、**最初の本物の契約が入った瞬間に、
 * これらがまとめて止まる**（それまではStripeが0件で一斉停止が見送られるため、
 * 誰も気づかない）。
 *
 * 目印を付けた行は止めない。目印は `admin_notes` に残るので、
 * 管理画面からも「これは売上ではない」と分かる。
 */
/**
 * profiles から読む列。**読む場所すべてが、これを使う。**
 *
 * 一斉停止の判定（isOrphanedActiveProfile → isCompedProfile）は admin_notes を見る。
 * ところが読む側の select が2箇所にあり、**片方に admin_notes が入っていなかった。**
 * 値が undefined になるので目印は常に効かず、
 * **無償提供先・検証用アカウントが canceled に落ちてサイトが止まる。**
 * 目印を用意した目的（最初の本物の契約が入った瞬間の一斉停止を防ぐ）が、
 * そのまま起きる。
 *
 * 止まっても、ログには他の停止と同じ行が1つ増えるだけ。誰も気づかない。
 */
export const PROFILE_BILLING_COLUMNS =
  'id, stripe_customer_id, stripe_subscription_id, subscription_status, plan, contract_starts_at, contract_ends_at, admin_notes';

export const COMP_MARKER = '[無償]';

export function isCompedProfile(profile: ProfileBilling): boolean {
  return (profile.admin_notes || '').includes(COMP_MARKER);
}

export function profileStatusFor(stripeStatus: string): string {
  // 知らない状態を勝手に active にしない。分からないときは止める側へ倒す。
  return STATUS_MAP[stripeStatus] ?? 'inactive';
}

export function isTerminal(stripeStatus: string): boolean {
  return TERMINAL_STRIPE_STATUSES.includes(stripeStatus);
}

export function customerIdOf(sub: StripeSubscriptionLike): string | null {
  if (!sub.customer) return null;
  return typeof sub.customer === 'string' ? sub.customer : sub.customer.id ?? null;
}

/** 会員（サイト来訪者）の課金は hp_members 側の話なので、ここでは扱わない。 */
export function isPlanSubscription(sub: StripeSubscriptionLike): boolean {
  return (sub.metadata || {}).kind !== 'member';
}

function iso(seconds: number | null | undefined): string | null {
  if (!seconds || !Number.isFinite(seconds)) return null;
  const date = new Date(seconds * 1000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export type ReconcileOutcome =
  | { action: 'in-sync' }
  /** 別の有効な契約がDBに紐づいている。自動で書き換えず、人が見る。 */
  | { action: 'conflict'; reason: string }
  /** もう課金されない古い契約で、DBはそれを見ていない。触らない。 */
  | { action: 'ignore'; reason: string }
  | { action: 'update'; updates: Record<string, unknown>; changed: string[] };

/**
 * 1件のStripe契約と、それに対応するprofileを突き合わせる。
 *
 * contract_starts_at には start_date（契約が始まった日）を使う。
 * current_period_start を使うと請求のたびに未来へ動き、最低利用期間の
 * 判定（lib/billing-portal-mode.ts）が永久に明けない。
 */
export function reconcileSubscription(
  profile: ProfileBilling,
  sub: StripeSubscriptionLike,
  now: Date = new Date(),
): ReconcileOutcome {
  const terminal = isTerminal(sub.status);
  const linked = profile.stripe_subscription_id;

  if (linked && linked !== sub.id) {
    // DBは別の契約を見ている。こちらが死んだ契約なら、ただの残骸。
    if (terminal) return { action: 'ignore', reason: 'terminal subscription not linked to the profile' };
    // 生きた契約が2本ある。どちらを正とするかは機械が決めてよい話ではない。
    return { action: 'conflict', reason: 'profile is linked to a different live subscription' };
  }

  const desired: Record<string, unknown> = {
    stripe_subscription_id: terminal ? null : sub.id,
    subscription_status: profileStatusFor(sub.status),
  };

  const startsAt = iso(sub.start_date);
  if (startsAt) desired.contract_starts_at = startsAt;
  // 期間の終わりは版で居場所が違う。直に読むと undefined になり、
  // 契約終了日が入らないまま既定値で固まっていた。
  const endsAt = iso(subscriptionPeriodEnd(sub));
  if (endsAt) desired.contract_ends_at = endsAt;

  const plan = (sub.metadata || {}).plan;
  // metadataにプランが無い契約でDBのプランを消さない。
  if (plan) desired.plan = plan;

  const current: Record<string, unknown> = {
    stripe_subscription_id: profile.stripe_subscription_id ?? null,
    subscription_status: profile.subscription_status ?? null,
    contract_starts_at: profile.contract_starts_at ?? null,
    contract_ends_at: profile.contract_ends_at ?? null,
    plan: profile.plan ?? null,
  };

  const changed = Object.keys(desired).filter(key => !sameValue(current[key], desired[key]));
  if (!changed.length) return { action: 'in-sync' };

  const updates: Record<string, unknown> = {};
  for (const key of changed) updates[key] = desired[key];
  void now;
  return { action: 'update', updates, changed };
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  // 時刻は表記揺れ（+00:00 と Z、ミリ秒の有無）があるので、時刻として比べる。
  if (typeof a === 'string' && typeof b === 'string') {
    const left = Date.parse(a);
    const right = Date.parse(b);
    if (!Number.isNaN(left) && !Number.isNaN(right)) return left === right;
  }
  return false;
}

/** DBだけが有効契約だと思っている人（Stripeに契約が無い）を見つける。 */
export const ACTIVE_PROFILE_STATUSES = ['active', 'trialing', 'past_due'];

export function isOrphanedActiveProfile(
  profile: ProfileBilling,
  liveSubscriptionIds: Set<string>,
): boolean {
  if (!ACTIVE_PROFILE_STATUSES.includes(profile.subscription_status ?? '')) return false;
  // 無償と分かっている行は、Stripeに契約が無くて当たり前なので止めない
  if (isCompedProfile(profile)) return false;
  if (!profile.stripe_subscription_id) return true;
  return !liveSubscriptionIds.has(profile.stripe_subscription_id);
}
