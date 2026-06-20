import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'LARU HP | AIでホームページを最短完成 | 月額999円〜',
  description: '業種別AIテンプレートで5分でHP完成。SEO自動最適化・LARUbot連携・ビジュアルエディタ搭載。個人は月額999円から、代理店向けエージェンシープラン¥19,800/月も。初月1円。',
  keywords: 'ホームページ作成,HP制作,AI,月額,格安,SEO,LARUbot,ホームページビルダー,代理店,エージェンシー',
  openGraph: {
    title: 'LARU HP — AIで最高のHPを最短で',
    description: '業種別テンプレート × AI自動生成 × ビジュアルエディタ。月額999円〜（初月1円）。代理店向けエージェンシープランも提供中。',
    type: 'website',
    url: 'https://laruvisona.jp/laruHP',
    siteName: 'LARU HP',
    images: [{ url: 'https://laruvisona.jp/og-laruHP.png', width: 1200, height: 630, alt: 'LARU HP — AIホームページビルダー' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LARU HP — AIで最高のHPを最短で',
    description: '業種別テンプレート × AI自動生成 × ビジュアルエディタ。月額999円〜（初月1円）。',
    images: ['https://laruvisona.jp/og-laruHP.png'],
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
    '@type': 'AggregateOffer',
    lowPrice: '999',
    highPrice: '19800',
    priceCurrency: 'JPY',
    offerCount: 4,
    offers: [
      { '@type': 'Offer', name: 'HP プラン', price: '999', priceCurrency: 'JPY', description: 'AIホームページ作成・ビジュアルエディタ' },
      { '@type': 'Offer', name: 'HP + LARUbot', price: '4980', priceCurrency: 'JPY', description: 'HP + AIチャットボット' },
      { '@type': 'Offer', name: 'HP + Bot + SEO', price: '9800', priceCurrency: 'JPY', description: 'HP + AIチャットボット + SEO自動最適化' },
      { '@type': 'Offer', name: 'エージェンシー', price: '19800', priceCurrency: 'JPY', description: 'クライアント数無制限・全機能込み代理店プラン' },
    ],
  },
  description: 'AIで業種別ホームページを自動生成するSaaSサービス。個人は月額999円から、代理店向けエージェンシープランは¥19,800/月。初月1円。',
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
