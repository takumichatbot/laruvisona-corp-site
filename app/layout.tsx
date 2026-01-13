import type { Metadata } from "next";
import { Inter, Noto_Sans_JP, Rajdhani, Fira_Code } from "next/font/google";
import "./globals.css";
import Script from "next/script";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const notoSansJP = Noto_Sans_JP({ subsets: ["latin"], variable: "--font-noto-sans-jp" });
const rajdhani = Rajdhani({ weight: ["500", "700"], subsets: ["latin"], variable: "--font-rajdhani" });
const firaCode = Fira_Code({ subsets: ["latin"], variable: "--font-fira-code" });

export const metadata: Metadata = {
  title: "株式会社LARUVisona | 「想像」を「実装」するテックパートナー",
  description: "株式会社LARUVisonaは、AIチャットボット「LARUbot」の開発運営および、Webシステム・アプリケーション開発を通じて、企業のDXと事業成長を支援するテクノロジーカンパニーです。",
  keywords: "AI,チャットボット,LARUbot,Web開発,システム開発,DX,コンサルティング,Next.js,React",
  authors: [{ name: "LARUVisona Inc." }],
  openGraph: {
    title: "株式会社LARUVisona | AI × Design × Tech",
    description: "株式会社LARUVisonaは、AIチャットボット「LARUbot」の開発運営および、Webシステム・アプリケーション開発を通じて、企業のDXと事業成長を支援するテクノロジーカンパニーです。",
    url: "https://laruvisona.jp",
    siteName: "LARUVisona",
    images: [
      {
        url: "https://larubot.tokyo/static/images/larubot_logo_original_transparent.png",
        width: 1200,
        height: 630,
      },
    ],
    locale: "ja_JP",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "株式会社LARUVisona | AI × Design × Tech",
    description: "AIテクノロジーとクリエイティブの融合。LARUVisonaは、あなたのビジネスの「次」を実装します。",
    images: ["https://larubot.tokyo/static/images/larubot_logo_original_transparent.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "your-google-verification-code",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={`${inter.variable} ${notoSansJP.variable} ${rajdhani.variable} ${firaCode.variable}`}>
      <head>
        {/* Google Tag Manager */}
        <Script id="google-tag-manager" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
          'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','GTM-MVQ8TDBF');`}
        </Script>
        
        {/* Font Awesome */}
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
        
        {/* Custom CSS */}
        <link rel="stylesheet" href="/assets/css/style.css" />
      </head>
      <body className="antialiased selection:bg-blue-500 selection:text-white">
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe 
            src="https://www.googletagmanager.com/ns.html?id=GTM-MVQ8TDBF"
            height="0" 
            width="0" 
            style={{display: 'none', visibility: 'hidden'}}
          ></iframe>
        </noscript>
        
        {children}
        
        {/* External Scripts */}
        <Script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js" strategy="lazyOnload" />
        <Script src="https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.globe.min.js" strategy="lazyOnload" />
        <Script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js" strategy="lazyOnload" />
        <Script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/ScrollTrigger.min.js" strategy="lazyOnload" />
        
        {/* LARUbot Embed */}
        <Script 
          src="https://larubot.tokyo/static/embed.js" 
          data-public-id="ここにあなたのLARUbotのパブリックIDを入れてください" 
          strategy="lazyOnload"
        />
      </body>
    </html>
  );
}
