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
  title: 'LARUVisona | 「想像」を「実装」する',
  description: 'AIとモダンWeb技術を駆使するテクノロジーパートナー',
  openGraph: {
    title: 'LARUVisona | 「想像」を「実装」する',
    description: 'AIとモダンWeb技術を駆使するテクノロジーパートナー',
    url: 'https://laruvisona.jp',
    siteName: 'LARUVisona',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'LARUVisona | 「想像」を「実装」する' }],
    locale: 'ja_JP',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LARUVisona | 「想像」を「実装」する',
    description: 'AIとモダンWeb技術を駆使するテクノロジーパートナー',
    images: ['/opengraph-image'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${spaceGrotesk.variable} ${notoSansJP.variable}`}>
      {/* 背景を真っ黒にして、文字を白ベースに設定 */}
      <body className="bg-[#030712] text-slate-100 antialiased selection:bg-blue-500 selection:text-white">
        <GoogleAnalytics />
        <SmoothScroll>
          {children}
        </SmoothScroll>
      </body>
    </html>
  );
}
