import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { OAUTH_STATE_COOKIE, oauthStateMatches } from '@/lib/oauth-state';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://laruvisona.jp';
  const done = (query: string) => {
    const res = NextResponse.redirect(`${appUrl}/laruHP/settings?${query}`);
    // state Cookie は成否にかかわらず使い捨て（同じ state を再利用させない）
    res.cookies.set(OAUTH_STATE_COOKIE, '', { httpOnly: true, path: '/api/auth/google', maxAge: 0 });
    return res;
  };
  const fail = (reason: string) => done(`gsc=error&reason=${reason}`);

  if (error || !code || !state) return fail('missing_params');

  // 1) CSRF: この認可を開始したブラウザ自身であること
  const cookieStore = await cookies();
  if (!oauthStateMatches(state, cookieStore.get(OAUTH_STATE_COOKIE)?.value)) {
    return fail('state_mismatch');
  }

  // 2) 書き込み先は state ではなく、いまログインしているユーザー。
  //    （ユーザーIDは秘密ではないため、state 由来のIDを信用すると他人の行に書ける）
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail('not_signed_in');

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return fail('not_configured');

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${appUrl}/api/auth/google/callback`,
      grant_type: 'authorization_code',
    }),
  });

  const tokens = await tokenRes.json().catch(() => ({})) as { refresh_token?: string };
  if (!tokenRes.ok || !tokens.refresh_token) return fail('no_refresh_token');

  const service = createServiceClient();
  const { error: updateError } = await service
    .from('profiles')
    .update({ google_refresh_token: tokens.refresh_token })
    .eq('id', user.id);
  if (updateError) return fail('save_failed');

  return done('gsc=connected');
}
