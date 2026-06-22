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
  '/laruHP/admin',
];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    },
  );

  // セッションを更新してトークンを最新に保つ（必須）
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED.some(p => pathname.startsWith(p));

  if (isProtected && !user) {
    const loginUrl = new URL('/laruHP/auth/login', request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ログイン済みユーザーが auth ページに来た場合はダッシュボードへ
  const isAuthPage = pathname.startsWith('/laruHP/auth/login') ||
                     pathname.startsWith('/laruHP/auth/signup');
  if (isAuthPage && user) {
    return NextResponse.redirect(new URL('/laruHP/dashboard', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/laruHP/:path*',
  ],
};
