import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // user ID passed during OAuth initiation
  const error = searchParams.get('error');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://laruvisona.jp';

  if (error || !code || !state) {
    return NextResponse.redirect(`${appUrl}/laruHP/settings?gsc=error`);
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${appUrl}/api/auth/google/callback`,
      grant_type: 'authorization_code',
    }),
  });

  const tokens = await tokenRes.json() as { refresh_token?: string; error?: string };

  if (!tokens.refresh_token) {
    return NextResponse.redirect(`${appUrl}/laruHP/settings?gsc=error&reason=no_refresh_token`);
  }

  const service = await createServiceClient();
  await service
    .from('profiles')
    .update({ google_refresh_token: tokens.refresh_token })
    .eq('id', state);

  return NextResponse.redirect(`${appUrl}/laruHP/settings?gsc=connected`);
}
