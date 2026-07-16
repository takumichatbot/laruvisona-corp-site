import './globals.css';
import { Space_Grotesk, Noto_Sans_JP } from 'next/font/google';
import SmoothScroll from '@/components/SmoothScroll';
import GoogleAnalytics from '@/components/GoogleAnalytics';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

const notoSansJP = Noto_Sans_JP({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-noto-sans-jp',
  display: 'swap',
});

export const metadata = {
  metadataBase: new URL('https://laruvisona.jp'),
  title: 'LaruVisona | 「想像」を「実装」する',
  description: 'AIとモダンWeb技術を駆使するテクノロジーパートナー',
  openGraph: {
    title: 'LaruVisona | 「想像」を「実装」する',
    description: 'AIとモダンWeb技術を駆使するテクノロジーパートナー',
    url: 'https://laruvisona.jp',
    siteName: 'LaruVisona',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'LaruVisona | 「想像」を「実装」する' }],
    locale: 'ja_JP',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LaruVisona | 「想像」を「実装」する',
    description: 'AIとモダンWeb技術を駆使するテクノロジーパートナー',
    images: ['/opengraph-image'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${spaceGrotesk.variable} ${notoSansJP.variable}`}>
      {/* 背景を真っ黒にして、文字を白ベースに設定 */}
      <body className="bg-[#030712] text-slate-100 antialiased selection:bg-blue-500 selection:text-white">
        {/* Organization 構造化データ（Googleにロゴ・社名を認識させる） */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: '株式会社LaruVisona',
              alternateName: 'LaruVisona',
              url: 'https://laruvisona.jp',
              logo: 'https://laruvisona.jp/images/logo_light.png',
              description: 'AIとモダンWeb技術を駆使するテクノロジーパートナー',
              sameAs: ['https://larubot.tokyo'],
            }),
          }}
        />
        <GoogleAnalytics />
        <SmoothScroll>
          {children}
        </SmoothScroll>
      </body>
    </html>
  );
}
