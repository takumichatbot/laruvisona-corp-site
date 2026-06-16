import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED = ['/laruHP/dashboard', '/laruHP/builder'];
const AUTH_PAGES = ['/laruHP/auth/login', '/laruHP/auth/signup'];

export async function proxy(request: NextRequest) {
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
  const { pathname } = request.nextUrl;

  // Redirect unauthenticated users away from protected pages
  const isProtected = PROTECTED.some(p => pathname.startsWith(p));
  if (isProtected && !user) {
    const loginUrl = new URL('/laruHP/auth/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from auth pages
  const isAuthPage = AUTH_PAGES.some(p => pathname.startsWith(p));
  if (isAuthPage && user) {
    return NextResponse.redirect(new URL('/laruHP/dashboard', request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/laruHP/dashboard/:path*', '/laruHP/builder/:path*', '/laruHP/auth/:path*'],
};
