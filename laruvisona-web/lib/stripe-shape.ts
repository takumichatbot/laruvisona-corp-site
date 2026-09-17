/**
 * Stripe の返す形が、版によって違うところ。
 *
 * lib/stripe.ts で apiVersion を '2026-05-27.dahlia' に固定している。
 * この版で、ふたつの場所が動いた。
 *
 *   Invoice.subscription            → Invoice.parent.subscription_details.subscription
 *   Subscription.current_period_end → Subscription.items.data[].current_period_end
 *
 * どちらも**無くなっただけで、例外は出ない。** undefined が返る。
 * 読み損ねても、そのまま静かに先へ進む。実際こうなっていた。
 *
 * ・invoice.payment_failed で契約IDが取れず break していた。
 *   **お客様のカードが落ちても past_due にならず、サービスも止まらず、
 *   お知らせも届かない。** Stripe が最後に契約を消すまで、無料で使われる。
 *   逆に、払えているのに止まったままにもなりうる。
 *
 * ・contract_ends_at が常に「処理した時刻＋6ヶ月」の既定値のまま入る。
 *   ダッシュボードが「最低契約期間: 〜◯月◯日」として見せている日付は、
 *   Stripe の実際の契約とは**無関係な数字**だった。
 *
 * webhook はエンドポイントごとの版で届くので、古い形で来ることもある。
 * だから両方を読む。片方だけにすると、版を動かした日にまた黙って壊れる。
 */

type Unknown = Record<string, unknown>;

function asId(value: unknown): string | null {
  if (typeof value === 'string' && value) return value;
  if (value && typeof value === 'object') {
    const id = (value as { id?: unknown }).id;
    if (typeof id === 'string' && id) return id;
  }
  return null;
}

/** 請求書が、どの契約のものか。 */
export function invoiceSubscriptionId(invoice: unknown): string | null {
  if (!invoice || typeof invoice !== 'object') return null;
  const inv = invoice as Unknown;

  // いまの形
  const parent = inv['parent'] as Unknown | undefined;
  const details = parent?.['subscription_details'] as Unknown | undefined;
  const fromParent = asId(details?.['subscription']);
  if (fromParent) return fromParent;

  // 古い形（古い版のエンドポイントから届くことがある）
  return asId(inv['subscription']) ?? asId(inv['subscription_id']);
}

/** いまの請求期間の終わり（秒）。分からなければ null。 */
export function subscriptionPeriodEnd(subscription: unknown): number | null {
  if (!subscription || typeof subscription !== 'object') return null;
  const sub = subscription as Unknown;

  // いまの形: 明細ごとに持つ。いちばん遅いものを契約の終わりとみなす。
  const items = sub['items'] as { data?: Array<Unknown> } | undefined;
  const ends = (items?.data ?? [])
    .map(item => item['current_period_end'])
    .filter((v): v is number => typeof v === 'number' && v > 0);
  if (ends.length > 0) return Math.max(...ends);

  // 古い形
  const legacy = sub['current_period_end'];
  return typeof legacy === 'number' && legacy > 0 ? legacy : null;
}

/** 契約が始まった日（秒）。最低利用期間は、ここから数える。 */
export function subscriptionStartedAt(subscription: unknown): number | null {
  if (!subscription || typeof subscription !== 'object') return null;
  const sub = subscription as Unknown;
  const start = sub['start_date'];
  if (typeof start === 'number' && start > 0) return start;

  // start_date が無い版のとき。請求期間の始まりは毎月動くので、
  // これを最低利用期間の起点にすると**いつまでも明けない。**
  // それでも無いよりはましなので、最後の手段としてだけ使う。
  const items = sub['items'] as { data?: Array<Unknown> } | undefined;
  const starts = (items?.data ?? [])
    .map(item => item['current_period_start'])
    .filter((v): v is number => typeof v === 'number' && v > 0);
  if (starts.length > 0) return Math.min(...starts);

  const legacy = sub['current_period_start'];
  return typeof legacy === 'number' && legacy > 0 ? legacy : null;
}
