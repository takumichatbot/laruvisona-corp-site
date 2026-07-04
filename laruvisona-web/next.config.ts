import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/plans', destination: '/laruHP/plans', permanent: true },
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
