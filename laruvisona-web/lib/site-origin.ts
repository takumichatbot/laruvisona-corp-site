// 顧客サイトの「正当な出所」を判定する。
//
// リクエストの Origin や、クライアントが送ってくる returnUrl をそのまま
// Stripe の戻り先や内部呼び出しの宛先に使うと、
//   - 決済後の利用者を攻撃者のドメインへ飛ばせる（オープンリダイレクト）
//   - 内部向けヘッダーを外部ドメインへ送らせられる
// ため、そのサイトが正当に配信されているホストだけを許可する。

export interface SiteHostInfo {
  slug?: string | null;
  custom_domain?: string | null;
}

/** そのサイトが正当に配信されうるホスト名の集合。 */
export function allowedHosts(site: SiteHostInfo): Set<string> {
  const mainHost = (process.env.NEXT_PUBLIC_APP_URL || '')
    .replace(/^https?:\/\//, '').replace(/\/$/, '').split(':')[0].toLowerCase();
  const allowed = new Set<string>();
  if (mainHost) {
    allowed.add(mainHost);
    allowed.add(`www.${mainHost}`);
    if (site.slug) allowed.add(`${site.slug.toLowerCase()}.${mainHost}`);
  }
  if (site.custom_domain) {
    const d = site.custom_domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (d) { allowed.add(d); allowed.add(`www.${d}`); }
  }
  return allowed;
}

export function appUrlFallback(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://laruvisona.jp').replace(/\/$/, '');
}

/** Origin ヘッダーの検証。許可外なら自サイトの URL に落とす。 */
export function safeOrigin(rawOrigin: string | null | undefined, site: SiteHostInfo): string {
  const fallback = appUrlFallback();
  if (!rawOrigin) return fallback;
  let u: URL;
  try { u = new URL(rawOrigin); } catch { return fallback; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return fallback;
  return allowedHosts(site).has(u.hostname.toLowerCase()) ? rawOrigin.replace(/\/$/, '') : fallback;
}

/**
 * 決済からの戻り先 URL の検証。
 * クエリ・フラグメントは落とし、許可ホストでなければ Origin → 自サイト の順で落とす。
 */
export function safeReturnUrl(
  rawReturnUrl: string | null | undefined,
  originHeader: string | null | undefined,
  site: SiteHostInfo,
): string {
  const base = safeOrigin(originHeader, site);
  if (!rawReturnUrl) return base;
  let u: URL;
  try { u = new URL(String(rawReturnUrl), base); } catch { return base; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return base;
  if (!allowedHosts(site).has(u.hostname.toLowerCase())) return base;
  return `${u.origin}${u.pathname}`.replace(/\/$/, '') || u.origin;
}
