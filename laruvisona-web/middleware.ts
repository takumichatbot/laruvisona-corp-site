import { NextRequest, NextResponse } from 'next/server';

const MAIN_HOST = (process.env.NEXT_PUBLIC_APP_URL || '')
  .replace(/^https?:\/\//, '')
  .replace(/\/$/, '');

export function middleware(req: NextRequest) {
  const hostname = (req.headers.get('host') || '').split(':')[0];
  const pathname = req.nextUrl.pathname;

  // Pass through: static assets, API, our own HP routes, next internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/hp') ||
    pathname.startsWith('/laruHP') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // Detect custom domain (not localhost, not main app domain, not vercel preview)
  const isSystemHost =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.vercel.app') ||
    hostname.endsWith('.local') ||
    (MAIN_HOST && (hostname === MAIN_HOST || hostname === `www.${MAIN_HOST}`));

  if (!isSystemHost && hostname) {
    // Rewrite to the by-domain handler, preserving path
    const url = req.nextUrl.clone();
    url.pathname = `/hp/by-domain/${hostname}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
};
