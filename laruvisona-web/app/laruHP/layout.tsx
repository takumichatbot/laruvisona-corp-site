import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'LARU HP | AIでホームページを最短完成 | 月額999円',
  description: '業種別AIテンプレートで5分でHP完成。SEO自動最適化・LARUbot連携・ビジュアルエディタ搭載。初月1円・月額999円から。',
  keywords: 'ホームページ作成,HP制作,AI,月額,格安,SEO,LARUbot,ホームページビルダー',
  openGraph: {
    title: 'LARU HP — AIで最高のHPを最短で',
    description: '業種別テンプレート × AI自動生成 × ビジュアルエディタ。月額999円（初月1円）。',
    type: 'website',
    url: 'https://laruvisona.jp/laruHP',
    siteName: 'LARU HP',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LARU HP — AIで最高のHPを最短で',
    description: '業種別テンプレート × AI自動生成 × ビジュアルエディタ。月額999円（初月1円）。',
  },
  alternates: {
    canonical: 'https://laruvisona.jp/laruHP',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'LARU HP',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  offers: {
    '@type': 'Offer',
    price: '999',
    priceCurrency: 'JPY',
    priceSpecification: {
      '@type': 'UnitPriceSpecification',
      price: '999',
      priceCurrency: 'JPY',
      unitText: 'MONTH',
    },
  },
  description: 'AIで業種別ホームページを自動生成するSaaSサービス。月額999円（初月1円）。',
  url: 'https://laruvisona.jp/laruHP',
  publisher: {
    '@type': 'Organization',
    name: '株式会社LARUVisona',
    url: 'https://laruvisona.jp',
  },
};

export default function LaruHPLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {children}
    </>
  );
}
