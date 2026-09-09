import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/plans', destination: '/laruHP/plans', permanent: true },
    ];
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
