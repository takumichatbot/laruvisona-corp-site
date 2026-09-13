import { LARUHP_APP_ORIGIN } from './laruhp-host';

/** Stripeから戻す先はリクエストのOriginを信用せず、運営側の固定originだけを使う。 */
export function billingAppOrigin(): string {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_APP_URL || LARUHP_APP_ORIGIN);
    if (url.protocol === 'https:' || (process.env.NODE_ENV !== 'production' && url.protocol === 'http:')) return url.origin;
  } catch { /* fixed fallback */ }
  return LARUHP_APP_ORIGIN;
}
