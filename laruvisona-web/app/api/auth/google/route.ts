import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { OAUTH_STATE_COOKIE, OAUTH_STATE_MAX_AGE_SEC, createOAuthState } from '@/lib/oauth-state';

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/laruHP/auth/login', req.url));

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: 'Google OAuth not configured' }, { status: 500 });

  // state はユーザーIDではなく使い捨ての乱数。同じ値を httpOnly Cookie に置き、
  // コールバックで突き合わせる（書き込み先はコールバック時のセッションから決める）。
  const state = createOAuthState();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://laruvisona.jp';
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${appUrl}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  const res = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  res.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    // Google からの戻りはトップレベル GET 遷移なので lax で届く。strict だと届かない。
    sameSite: 'lax',
    path: '/api/auth/google',
    maxAge: OAUTH_STATE_MAX_AGE_SEC,
  });
  return res;
}
