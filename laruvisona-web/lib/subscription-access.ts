/**
 * 「いま、サービスを使ってよい契約状態か」の唯一の定義。
 *
 * ここを1か所にする理由。以前は場所ごとに書き方が違っていた。
 *   app/api/sites/route.ts         … active または trialing を通す
 *   app/api/ai/blog-generate       … active または trialing を通す
 *   app/api/sites/[id]/publish     … active だけ。trialing を弾いていた
 *
 * その結果、試用中（trialing）の人は「サイトは作れるのに公開だけできない」
 * という状態になっていた。作らせておいて最後で止めるのが一番悪い。
 *
 * past_due（支払い遅延）はここに入れない。Stripeが再請求を続けている間で、
 * 止めるのが正しい。canceled・inactive も同じ。
 */
export const SERVICE_ACTIVE_STATUSES = ['active', 'trialing'] as const;

export function hasServiceAccess(status: string | null | undefined): boolean {
  return SERVICE_ACTIVE_STATUSES.includes((status ?? '') as typeof SERVICE_ACTIVE_STATUSES[number]);
}
