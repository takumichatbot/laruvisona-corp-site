import type { Metadata, Viewport } from 'next';
import { jsonForScript } from '@/lib/safe-markup';
import PwaInit from '@/components/PwaInit';
import { PLANS, TERMS } from '@/lib/laruhp-facts';

export const dynamic = 'force-dynamic';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'LARU HP | 完成像を見ながら作るホームページ制作サービス',
  description: '業種と目的から下書きを作り、写真・文章・配色を完成像で確認しながら編集。問い合わせ、独自ドメイン、ショップ・決済、SEO基本設定に対応します。月額999円から。',
  keywords: 'ホームページ作成,HP制作,AI,SEO,LARUbot,ホームページビルダー,独自ドメイン',
  openGraph: {
    title: 'LARU HP — 完成像を見ながら作るホームページ',
    description: '写真と言葉を整え、問い合わせや独自ドメインまで。月額999円から始められます。',
    type: 'website',
    url: 'https://laruhp.com/',
    siteName: 'LARU HP',
    images: [{ url: '/laruHP/opengraph-image', width: 1200, height: 630, alt: 'LARU HP — AIホームページビルダー' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LARU HP — 完成像を見ながら作るホームページ',
    description: '写真と言葉を整え、問い合わせや独自ドメインまで。月額999円から始められます。',
    images: ['/laruHP/opengraph-image'],
  },
  alternates: {
    canonical: 'https://laruhp.com/',
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
    lowPrice: String(PLANS[0].monthly),
    highPrice: String(PLANS[PLANS.length - 1].monthly),
    priceCurrency: 'JPY',
    offerCount: PLANS.length,
    offers: PLANS.map(plan => ({
      '@type': 'Offer', name: plan.name, price: String(plan.monthly), priceCurrency: 'JPY',
      description: `${plan.lead}。${TERMS.firstMonthFree}。`,
    })),
  },
  description: '業種と目的からホームページの下書きを作り、完成像を見ながら写真・文章・配色を編集して公開できるサービス。月額999円から。',
  url: 'https://laruhp.com/',
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
