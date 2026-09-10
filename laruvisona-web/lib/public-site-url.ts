// 顧客が公開しているサイトのURLを1か所で決める。
//
// 同じサイトが3つの形で開ける:
//   1. パス形式        laruvisona.jp/hp/<slug>
//   2. サブドメイン形式 <slug>.laruvisona.jp
//   3. 独自ドメイン形式 example.com
//
// ここで分けているのは2つの概念:
//   canonicalBase … そのサイトの「正規URL」。保存された公開先の方針から
//                   一意に決まり、どの入口で開かれても変わらない。
//   isHostForSite … 受け取ったホストが、そのサイトを配信してよいホストか。
//
// 入口によって canonical が変わると、同じページに複数の正規URLができる。
// また、別ホストの正規URLから origin を落として相対リンクにすると、
// 会社ホストで「サイトのトップへ」が会社トップに戻ってしまう。
// リンクは正規URLへの絶対URLにする。

export interface PublicSite {
  slug?: string | null;
  custom_domain?: string | null;
}

export function mainHost(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://laruvisona.jp')
    .replace(/^https?:\/\//, '').replace(/\/$/, '').split(':')[0].toLowerCase();
}

export function appOrigin(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://laruvisona.jp').replace(/\/$/, '');
}

/** Host ヘッダーからホスト名だけを取り出す */
export function hostnameOf(rawHost: string | null | undefined): string {
  return (rawHost || '').split(',')[0].trim().split(':')[0].toLowerCase();
}

/**
 * そのサイトの正規URL。入口のホストに依存しない。
 *
 * 方針: 確認済みの主独自ドメインがあればそれ。無ければパス形式。
 * （サブドメイン形式は「開ける形」ではあるが、正規URLにはしない。
 *   独自ドメインの接続前後で正規URLが揺れないようにするため）
 */
export function canonicalBase(site: PublicSite): string {
  const custom = (site.custom_domain || '').trim().toLowerCase();
  if (custom) return `https://${custom}`;
  const slug = (site.slug || '').trim().toLowerCase();
  return slug ? `${appOrigin()}/hp/${slug}` : appOrigin();
}

/** 正規URLの基点にパスを足す */
export function siteUrl(base: string, path = ''): string {
  if (!path || path === '/') return base;
  return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

/** サイト内リンク。正規URLへの絶対URLにする */
export function siteLink(site: PublicSite, path = ''): string {
  return siteUrl(canonicalBase(site), path);
}

/**
 * このホストで、このサイトを配信してよいか。
 *
 * proxy がホストから slug を決めていても、内部パス（/hp/<slug>/...）を
 * 直接指定されると別サイトを指定できる。表示側でも必ず確認する。
 */
export function isHostForSite(site: PublicSite, rawHost: string | null | undefined): boolean {
  const host = hostnameOf(rawHost);
  if (!host) return true;                 // Host が取れない実行経路（ビルド時など）は素通し
  const main = mainHost();
  const custom = (site.custom_domain || '').trim().toLowerCase();
  const slug = (site.slug || '').trim().toLowerCase();

  if (main && (host === main || host === `www.${main}`)) return true;   // 会社ホスト（パス形式）
  if (custom && (host === custom || host === `www.${custom}`)) return true;
  if (slug && main && host === `${slug}.${main}`) return true;
  // localhost / onrender など、開発・基盤のホスト
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.onrender.com')) return true;
  return false;
}
