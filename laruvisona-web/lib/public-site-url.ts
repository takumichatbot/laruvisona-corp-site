// 顧客が公開しているサイトの「正規URL」を1か所で決める。
//
// 同じサイトが3つの形で開ける:
//   1. パス形式        laruvisona.jp/hp/<slug>
//   2. サブドメイン形式 <slug>.laruvisona.jp
//   3. 独自ドメイン形式 example.com
//
// canonical・JSON-LD・sitemap・記事リンク・戻るリンク・決済の戻り先が
// ばらばらの形を作ると、同じ内容が複数のURLで出て、決済から別ホストへ
// 戻されることになる。どの形で開かれたかを見て、そのサイトの正規URLに揃える。

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
 * そのサイトの正規URLの基点。
 *
 * 独自ドメインで開かれていて、それがこのサイトの主な公開URLなら独自ドメイン。
 * サブドメインで開かれていればサブドメイン。それ以外はパス形式。
 * （独自ドメインは sites.custom_domain にしか入らない＝確認済みだけなので、
 *   ここでホストを信用してよい）
 */
export function publicBase(site: PublicSite, rawHost: string | null | undefined): string {
  const host = hostnameOf(rawHost);
  const main = mainHost();
  const custom = (site.custom_domain || '').trim().toLowerCase();
  const slug = (site.slug || '').trim().toLowerCase();

  if (custom && (host === custom || host === `www.${custom}`)) {
    return `https://${custom}`;
  }
  if (slug && main && host === `${slug}.${main}`) {
    return `https://${slug}.${main}`;
  }
  if (custom) return `https://${custom}`;
  if (slug && main) return `${appOrigin()}/hp/${slug}`;
  return appOrigin();
}

/** 正規URLの基点にパスを足す */
export function siteUrl(base: string, path = ''): string {
  if (!path || path === '/') return base;
  return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

/**
 * サイト内リンクのパス。
 * パス形式のときだけ /hp/<slug> の接頭辞が要る。
 */
export function sitePath(site: PublicSite, rawHost: string | null | undefined, path = ''): string {
  const base = publicBase(site, rawHost);
  const origin = appOrigin();
  if (base.startsWith(`${origin}/hp/`)) {
    // パス形式: /hp/<slug>/xxx
    return siteUrl(base, path).slice(origin.length);
  }
  // 独自ドメイン・サブドメイン形式: /xxx
  return path ? `/${path.replace(/^\//, '')}` : '/';
}
