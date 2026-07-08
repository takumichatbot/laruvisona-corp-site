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

// 新規ユーザー向けの導線。未ログインならログインではなく「新規登録」へ誘導する
// （LPのCTA「初月無料で始める」→ /laruHP/onboarding は新規顧客が大半のため）
const SIGNUP_FIRST = ['/laruHP/onboarding'];

const MAIN_HOST = (process.env.NEXT_PUBLIC_APP_URL || '')
  .replace(/^https?:\/\//, '')
  .replace(/\/$/, '');

// 代理店の管理画面ドメイン判定（service roleで参照・5分キャッシュ）
const adminDomainCache = new Map<string, { v: boolean; t: number }>();
async function isAgencyAdminDomain(host: string): Promise<boolean> {
  const c = adminDomainCache.get(host);
  const now = Date.now();
  if (c && now - c.t < 5 * 60 * 1000) return c.v;
  let v = false;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    try {
      const r = await fetch(`${url}/rest/v1/profiles?agency_admin_domain=eq.${encodeURIComponent(host)}&select=id&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
      const d = await r.json();
      v = Array.isArray(d) && d.length > 0;
    } catch { /* fail open as non-admin */ }
  }
  adminDomainCache.set(host, { v, t: now });
  return v;
}

export async function proxy(request: NextRequest) {
  const hostname = (request.headers.get('host') || '').split(':')[0];
  const pathname = request.nextUrl.pathname;

  const isSystemHost =
    !hostname ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.vercel.app') ||
    hostname.endsWith('.onrender.com') ||
    hostname.endsWith('.local') ||
    (MAIN_HOST && (hostname === MAIN_HOST || hostname === `www.${MAIN_HOST}`));

  // Custom domain routing: rewrite non-system hostnames（主ドメインは即スキップ＝DB照会なし）
  if (
    !isSystemHost &&
    !pathname.startsWith('/_next') &&
    !pathname.startsWith('/api') &&
    !pathname.startsWith('/hp') &&
    !pathname.startsWith('/laruHP') &&
    pathname !== '/favicon.ico'
  ) {
    // サブドメイン: <slug>.MAIN_HOST → /hp/<slug>（robots.txt/sitemap.xml等のサブパスもそのまま透過）
    // ワイルドカードDNS（*.MAIN_HOST → Render）を設定して初めて到達するホスト名なのでDB照会不要
    const sub = MAIN_HOST && hostname.endsWith(`.${MAIN_HOST}`)
      ? hostname.slice(0, -(MAIN_HOST.length + 1))
      : null;
    if (sub && !sub.includes('.')) {
      const url = request.nextUrl.clone();
      url.pathname = `/hp/${sub}${pathname === '/' ? '' : pathname}`;
      return NextResponse.rewrite(url);
    }

    // 管理画面の独自ドメインなら、ルートをダッシュボードへ（/laruHP・/api は下で通常処理）
    if (await isAgencyAdminDomain(hostname)) {
      if (pathname === '/') {
        const url = request.nextUrl.clone();
        url.pathname = '/laruHP/dashboard';
        return NextResponse.rewrite(url);
      }
    } else {
      const url = request.nextUrl.clone();
      // robots.txt / sitemap.xml は独自ドメイン専用ルートへ（それ以外はトップを表示）
      url.pathname = (pathname === '/robots.txt' || pathname === '/sitemap.xml')
        ? `/hp/by-domain/${hostname}${pathname}`
        : `/hp/by-domain/${hostname}`;
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
    const isSignupFirst = SIGNUP_FIRST.some(p => pathname.startsWith(p));
    const dest = isSignupFirst ? '/laruHP/auth/signup' : '/laruHP/auth/login';
    const redirectUrl = new URL(dest, request.url);
    redirectUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Auth pages are always accessible so users can switch accounts
  // The login page itself handles already-logged-in state

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
};
