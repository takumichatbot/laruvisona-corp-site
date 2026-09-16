import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        // 全公開ホストはHTTPSで配信する。includeSubDomains は顧客の別サブドメインへ
        // 影響を広げるため付けない。
        { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
      ],
    }];
  },
  // 新LPのプレビューを /laruHP/lp-next で見せつつ、実体はレイアウト配下の外に置く。
  //
  // なぜこうするか:
  // app/laruHP/layout.tsx が force-dynamic を指定しているため、その配下の
  // ページは何をしても要求ごとにサーバーで描画される。子ページに
  // force-static を書いても上書きできないことを本番で確認した
  // （cache-control: private, no-cache, no-store / cf-cache-status: DYNAMIC）。
  // かといって force-dynamic を配下48ページから一括で外すのは影響が大きい。
  //
  // 実体を app/lp-next に置けばルートレイアウトだけが適用されるので静的にできる。
  // rewrite なのでURLは /laruHP/lp-next のまま変わらない。
  async rewrites() {
    return [
      { source: '/laruHP/lp-next', destination: '/lp-next' },
    ];
  },
  // 旧サイトの名残。Search Console に 404 として残り続けている
  // （/index.html は 2026-09-04、/terms.html は 2026-07-06 にもクロールされている）。
  // 消えるのを待つより、今のページへ送ったほうが、その分の評価を拾える。
  async redirects() {
    return [
      { source: '/index.html', destination: '/', permanent: true },
      { source: '/terms.html', destination: '/terms', permanent: true },
      { source: '/privacy.html', destination: '/privacy', permanent: true },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: 'laruvisona',
  project: 'laruvisona-hp',
  silent: true,
  widenClientFileUpload: true,
  sourcemaps: { disable: true },
  webpack: {
    treeshake: { removeDebugLogging: true },
  },
});
