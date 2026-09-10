import type { Metadata, Viewport } from 'next';
import { jsonForScript } from '@/lib/safe-markup';
import PwaInit from '@/components/PwaInit';

export const dynamic = 'force-dynamic';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'LARU HP | AIでホームページを最短完成 | 月額999円〜',
  description: '業種別AIテンプレートで5分でHP完成。SEO自動最適化・LARUbot連携・ビジュアルエディタ搭載。個人は月額999円から、代理店向けエージェンシープラン¥19,800/月も。初月無料。',
  keywords: 'ホームページ作成,HP制作,AI,月額,格安,SEO,LARUbot,ホームページビルダー,代理店,エージェンシー',
  openGraph: {
    title: 'LARU HP — AIで最高のHPを最短で',
    description: '業種別テンプレート × AI自動生成 × ビジュアルエディタ。月額999円〜（初月無料）。代理店向けエージェンシープランも提供中。',
    type: 'website',
    url: 'https://laruvisona.jp/laruHP',
    siteName: 'LARU HP',
    images: [{ url: '/laruHP/opengraph-image', width: 1200, height: 630, alt: 'LARU HP — AIホームページビルダー' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LARU HP — AIで最高のHPを最短で',
    description: '業種別テンプレート × AI自動生成 × ビジュアルエディタ。月額999円〜（初月無料）。',
    images: ['/laruHP/opengraph-image'],
  },
  alternates: {
    canonical: 'https://laruvisona.jp/laruHP',
  },
  // manifest と icons は metadata で指定する。生の <link> を書くと、
  // 入れ子のレイアウト（/laruHP/bridge など）で別の manifest を出したいときに
  // タグが二重になってしまう。metadata なら深いセグメントの指定が勝つ。
  manifest: '/laruhp-manifest.json',
  icons: {
    icon: [
      { url: '/laruhp-icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/laruhp-icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
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
      { '@type': 'Offer', name: 'HP + Bot Standard', price: '4980', priceCurrency: 'JPY', description: 'HP + AIチャットボット' },
      { '@type': 'Offer', name: 'HP + Bot + SEO', price: '9800', priceCurrency: 'JPY', description: 'HP + AIチャットボット + SEO自動最適化' },
      { '@type': 'Offer', name: 'エージェンシー', price: '19800', priceCurrency: 'JPY', description: 'クライアント数無制限・全機能込み代理店プラン' },
    ],
  },
  description: 'AIで業種別ホームページを自動生成するSaaSサービス。個人は月額999円から、代理店向けエージェンシープランは¥19,800/月。初月無料。',
  url: 'https://laruvisona.jp/laruHP',
  publisher: {
    '@type': 'Organization',
    name: '株式会社LaruVisona',
    url: 'https://laruvisona.jp',
  },
};

export default function LaruHPLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* manifest と apple-touch-icon は上の metadata で指定している。
          以前はここで /manifest.json（社内ツール Bridge のもの）を読んでいた。
          アイコンに 1024x1024 / 1.9MB の PNG が指定されており、LPを開いた全員が
          それをダウンロードしていた（ページ重量の約46%）。名前も
          「Bridge — AI Coding Assistant」だったので、ホーム画面に追加すると
          顧客の端末に社内ツール名のアイコンが並ぶ状態だった。
          Bridge 自身の manifest は app/laruHP/bridge/layout.tsx で上書きする。 */}
      <meta name="theme-color" content="#0284c7" />
      {/* Font Awesome の CDN 読み込みはやめた。laruHP 配下では1つも使っておらず
          （使っているのは会社サイト側の2ファイルだけ・5種類）、
          描画をブロックする外部CSSとWebフォントを全ページで読んでいただけだった。 */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonForScript(jsonLd) }} />
      <PwaInit />
      {children}
    </>
  );
}
