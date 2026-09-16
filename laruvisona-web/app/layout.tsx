import './globals.css';
import { jsonForScript } from '@/lib/safe-markup';
import SmoothScroll from '@/components/SmoothScroll';
import GoogleAnalytics from '@/components/GoogleAnalytics';
import LarubotWidget from '@/components/LarubotWidget';
import { organizationLd, websiteLd } from '@/lib/organization-ld';

// フォントはここで読まない。
// 共通レイアウトに置くと、日本語の @font-face 宣言だけで CSS 100KB（転送後）が
// 管理画面にも顧客の公開ページにも配られる。顧客のページは顧客が選んだ書体で
// 組まれるので、会社の書体は要らない。
// ブランドを見せる画面は components/BrandFonts.tsx を置いて読み込む。
// 置かない画面は app/globals.css の既定（端末フォント）のまま。

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
    <html lang="ja">
      {/* 背景を真っ黒にして、文字を白ベースに設定 */}
      <body className="bg-[#030712] text-slate-100 antialiased selection:bg-blue-500 selection:text-white">
        {/* 会社とサイトの構造化データ。定義は lib/organization-ld.ts の1か所。
            以前は layout と /local の2か所にあり、住所・説明・sameAs が食い違っていた。 */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonForScript([organizationLd(), websiteLd()]) }}
        />
        <GoogleAnalytics />
        <SmoothScroll>
          {children}
        </SmoothScroll>
        {/* LARUbot AIチャットボット（全ページ / イントロ完了後に遅延ロード） */}
        <LarubotWidget />
      </body>
    </html>
  );
}
