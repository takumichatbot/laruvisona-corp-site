import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestHeaders = Object.fromEntries(request.headers.entries());
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/laruHP/dashboard';

  // Use NEXT_PUBLIC_APP_URL or forwarded host to get the real public origin
  // (Render serves internally on localhost:10000, not the public domain)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const forwardedHost = requestHeaders['x-forwarded-host'];
  const forwardedProto = requestHeaders['x-forwarded-proto'] || 'https';
  const origin = appUrl || (forwardedHost ? `${forwardedProto}://${forwardedHost}` : new URL(request.url).origin);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/laruHP/auth/login?error=auth`);
}
