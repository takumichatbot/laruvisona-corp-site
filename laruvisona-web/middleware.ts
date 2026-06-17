import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Derive hostname from the existing NEXT_PUBLIC_APP_URL (e.g. "https://laruvisona.com" → "laruvisona.com")
const APP_HOSTNAME = (() => {
  const url = process.env.NEXT_PUBLIC_APP_URL || '';
  try { return new URL(url).hostname; } catch { return url.replace(/^https?:\/\//, '').split('/')[0] || 'laruvisona.com'; }
})();

export function middleware(req: NextRequest) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
  // Strip port for local dev
  const hostname = host.split(':')[0];

  // Skip requests from the app's own domain or localhost
  if (
    hostname === APP_HOSTNAME ||
    hostname === `www.${APP_HOSTNAME}` ||
    hostname.endsWith('.vercel.app') ||
    hostname.endsWith('.onrender.com') ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1'
  ) {
    return NextResponse.next();
  }

  // Custom domain: rewrite to /hp/by-domain/[domain]
  const url = req.nextUrl.clone();
  url.pathname = `/hp/by-domain/${hostname}${url.pathname === '/' ? '' : url.pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    // Match all paths except Next.js internals and static files
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
};
