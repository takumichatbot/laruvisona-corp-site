import { jsonForScript } from '@/lib/safe-markup';
import { schemaTypeFor } from '@/lib/industry-schema';

export interface BusinessInfo {
  type?: string;
  name?: string;
  description?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  phone?: string;
  priceRange?: string;
  openingHours?: string[];
  latitude?: string;
  longitude?: string;
  sameAs?: string[];
}

/*
  店舗の構造化データ。**ここが唯一の出どころ。**

  以前は公開HTML（lib/html-export.ts）にも同じものが焼き込まれていて、
  検索側には**食い違う店舗情報が2件**見えていた。向こうは
    ・住所も電話もいつも空（公開時に渡していなかった）
    ・URLが必ず laruvisona.jp/hp/<slug>（独自ドメインでもこちらを名乗る）
  という状態だった。構造化データは見た目に出ず、検索結果に出るまで
  数週間かかるので、誰も気づかない。

  こちらに寄せた。保存されている値をそのつど読むので、住所を直したら
  次の表示から反映される（焼き込みだと公開し直すまで古いまま）。
  業種→型の対応（15業種）も、向こうから持ってきた。
*/
export function buildJsonLd(siteName: string, baseUrl: string, seo: { description?: string }, bi: BusinessInfo, industry?: string | null): string {
  const url = baseUrl;
  const schemaType = bi.type || schemaTypeFor(industry ?? undefined);
  const name = bi.name || siteName;

  const obj: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': schemaType,
    name,
    url,
  };

  if (bi.description || seo.description) obj.description = bi.description || seo.description;
  if (bi.phone) obj.telephone = bi.phone;
  if (bi.priceRange) obj.priceRange = bi.priceRange;

  if (bi.address || bi.city || bi.postalCode) {
    obj.address = {
      '@type': 'PostalAddress',
      ...(bi.address ? { streetAddress: bi.address } : {}),
      ...(bi.city ? { addressLocality: bi.city } : {}),
      ...(bi.postalCode ? { postalCode: bi.postalCode } : {}),
      addressCountry: 'JP',
    };
  }

  if (bi.latitude && bi.longitude) {
    obj.geo = {
      '@type': 'GeoCoordinates',
      latitude: bi.latitude,
      longitude: bi.longitude,
    };
  }

  if (bi.openingHours?.length) {
    obj.openingHours = bi.openingHours;
  }

  if (bi.sameAs?.length) {
    obj.sameAs = bi.sameAs.filter(Boolean);
  }

  return jsonForScript(obj);
}
