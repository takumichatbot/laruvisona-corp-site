import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';
import { execSync } from 'node:child_process';

// いま動いているのがどのコミットかを、ビルドのときに焼き込む。
//
// 置き場所によって入る変数が違う（Vercel・Render・自前のサーバー…）ので、
// 変数を1つに決め打ちできない。無ければ git に聞く。git も無ければ空のまま。
// **分からないときに、それらしい値を作らないこと。**
// 嘘の識別子が入ると、「反映済み」と出たまま古いものが動き続ける。
function buildCommit(): string {
  for (const v of [
    process.env.BUILD_COMMIT,
    process.env.VERCEL_GIT_COMMIT_SHA,
    process.env.GIT_COMMIT_SHA,
    process.env.RENDER_GIT_COMMIT,
    process.env.SOURCE_VERSION,
  ]) {
    if (typeof v === 'string' && /^[0-9a-f]{7,40}$/.test(v)) return v;
  }
  try {
    return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim();
  } catch {
    return '';
  }
}

const BUILD_COMMIT = buildCommit();

const nextConfig: NextConfig = {
  // /api/health がこれを返す。出荷係が push と本番を突き合わせるのに使う。
  env: { BUILD_COMMIT, BUILD_TIME: new Date().toISOString() },
  // ビルドの識別子にも同じものを使う。どのコミットのビルドかが追える。
  generateBuildId: async () => BUILD_COMMIT || null,
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
