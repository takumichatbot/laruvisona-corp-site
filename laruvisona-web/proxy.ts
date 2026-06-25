import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED = [
  '/laruHP/dashboard',
  '/laruHP/builder',
  '/laruHP/settings',
  '/laruHP/contacts',
  '/laruHP/crm',
  '/laruHP/booking',
  '/laruHP/newsletter',
  '/laruHP/blog',
  '/laruHP/larubot-logs',
  '/laruHP/agency',
  '/laruHP/onboarding',
  // /laruHP/admin は PIN 認証のみ（Supabase auth 不要）
];
const AUTH_PAGES = ['/laruHP/auth/login', '/laruHP/auth/signup'];

const MAIN_HOST = (process.env.NEXT_PUBLIC_APP_URL || '')
  .replace(/^https?:\/\//, '')
  .replace(/\/$/, '');

export async function proxy(request: NextRequest) {
  const hostname = (request.headers.get('host') || '').split(':')[0];
  const pathname = request.nextUrl.pathname;

  // Custom domain routing: rewrite non-system hostnames to /hp/by-domain/[domain]
  if (
    !pathname.startsWith('/_next') &&
    !pathname.startsWith('/api') &&
    !pathname.startsWith('/hp') &&
    !pathname.startsWith('/laruHP') &&
    pathname !== '/favicon.ico'
  ) {
    const isSystemHost =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.endsWith('.vercel.app') ||
      hostname.endsWith('.onrender.com') ||
      hostname.endsWith('.local') ||
      (MAIN_HOST && (hostname === MAIN_HOST || hostname === `www.${MAIN_HOST}`));

    if (!isSystemHost && hostname) {
      const url = request.nextUrl.clone();
      url.pathname = `/hp/by-domain/${hostname}`;
      return NextResponse.rewrite(url);
    }
  }

  // Auth session handling for laruHP routes
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Redirect unauthenticated users away from protected pages
  const isProtected = PROTECTED.some(p => pathname.startsWith(p));
  if (isProtected && !user) {
    const loginUrl = new URL('/laruHP/auth/login', request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Auth pages are always accessible so users can switch accounts
  // The login page itself handles already-logged-in state

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
};
