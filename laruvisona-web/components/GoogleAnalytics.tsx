'use client';
import { usePathname } from 'next/navigation';
import Script from 'next/script';

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export default function GoogleAnalytics() {
  const path = usePathname();
  // 確認URLには予約を変更できるキーがある。解析タグへURLや入力を渡さない。
  if (!GA_ID || path?.endsWith('/reserve') || path?.startsWith('/laruHP/booking')) return null;
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          // laruhp.com（案内）と laruvisona.jp（制作・決済）を1つの訪問として数える。
          // GA4 標準の linker。行き来するリンクに _gl が付く。
          gtag('config', '${GA_ID}', {
            page_path: window.location.pathname,
            linker: { domains: ['laruhp.com', 'laruvisona.jp'] },
          });
        `}
      </Script>
    </>
  );
}
