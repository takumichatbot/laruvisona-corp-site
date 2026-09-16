/**
 * 会社の構造化データを、1か所で持つ。
 *
 * ここを作った理由。以前は Organization の定義が2か所にあり、中身が食い違っていた。
 *   app/layout.tsx   … 住所なし、sameAs は larubot.tokyo だけ
 *   app/local/page.tsx … 住所あり、description なし、logo なし
 * 検索側から見ると、同じ会社について違うことを言っているサイトになる。
 *
 * この会社は流入の大半が指名検索なので、「この名前は何者か」を
 * 正確に伝えることが、いちばん効く構造化データである。
 */

export const ORG_ID = 'https://laruvisona.jp/#organization';
export const SITE_ID = 'https://laruvisona.jp/#website';

/** 対応している地域。/local の記載と同じものを使う。 */
export const AREAS_SERVED = ['板橋区', '足立区', '豊島区', '北区', '練馬区', '荒川区', '文京区', '川口市'];

export const ORGANIZATION = {
  '@type': 'Organization',
  '@id': ORG_ID,
  name: '株式会社LaruVisona',
  legalName: '株式会社LaruVisona',
  alternateName: 'LaruVisona',
  url: 'https://laruvisona.jp',
  logo: 'https://laruvisona.jp/images/logo_light.png',
  description:
    '自社サービスを企画・開発・運用しながら、受託開発も請ける会社。AIシステムの点検、サイトやシステムの修理、ホームページ制作、業務の仕組みづくり、Webサービス開発、保守まで。',
  foundingDate: '2026-04-06',
  email: 'info@laruvisona.jp',
  address: {
    '@type': 'PostalAddress',
    postalCode: '174-0072',
    addressRegion: '東京都',
    addressLocality: '板橋区',
    streetAddress: '南常盤台1丁目11-6-101号室',
    addressCountry: 'JP',
  },
  // 自社で運用しているものと、手がけたもの。ばらばらに書くと同一性が伝わらない。
  sameAs: ['https://larubot.tokyo', 'https://laruhp.com', 'https://www.flastal.com'],
} as const;

export function organizationLd(extra: Record<string, unknown> = {}) {
  return { '@context': 'https://schema.org', ...ORGANIZATION, ...extra };
}

/** 地域ページ用。対応地域つき。 */
export function organizationWithAreaLd() {
  return organizationLd({
    areaServed: AREAS_SERVED.map(name => ({ '@type': 'AdministrativeArea', name })),
  });
}

export function websiteLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': SITE_ID,
    url: 'https://laruvisona.jp/',
    name: '株式会社LaruVisona',
    inLanguage: 'ja',
    publisher: { '@id': ORG_ID },
  };
}

/** 階層のあるページに付ける。検索結果のパンくず表示に使われる。 */
export function breadcrumbLd(trail: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.name,
      item: `https://laruvisona.jp${t.path}`,
    })),
  };
}

/**
 * 受託のサービスと料金。
 *
 * 金額は画面に出している文字列（「¥150,000〜」等）から数字だけを取り出す。
 * 別に書き写すと、料金表を直したときに構造化データだけ古い額が残る。
 */
export function priceFrom(label: string): number | null {
  const digits = label.replace(/[^\d]/g, '');
  return digits ? Number(digits) : null;
}

export function serviceOffersLd(services: { title: string; price: string; desc: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: '受託開発',
    provider: { '@id': ORG_ID },
    areaServed: 'JP',
    url: 'https://laruvisona.jp/services',
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: '受託開発サービスと料金',
      itemListElement: services.map(s => {
        const price = priceFrom(s.price);
        return {
          '@type': 'Offer',
          itemOffered: { '@type': 'Service', name: s.title, description: s.desc },
          ...(price !== null
            ? {
                price,
                priceCurrency: 'JPY',
                // 「〜」からの参考価格なので、確定額ではないことを示す
                priceSpecification: {
                  '@type': 'PriceSpecification',
                  minPrice: price,
                  priceCurrency: 'JPY',
                  valueAddedTaxIncluded: false,
                },
              }
            : {}),
        };
      }),
    },
  };
}
