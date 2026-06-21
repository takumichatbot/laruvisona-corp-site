import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

type Params = { params: Promise<{ id: string }> };

// GET — called when user clicks "承認する" in the invite page
export async function GET(req: Request, { params }: Params) {
  const { id: siteId } = await params;
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://laruvisona.jp';

  if (!token) return NextResponse.redirect(`${appUrl}/laruHP/dashboard?invite=error`);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${appUrl}/laruHP/auth/login?redirect=${encodeURIComponent(`${appUrl}/laruHP/invite/${token}`)}`);
  }

  const service = await createServiceClient();

  const { data: member } = await service
    .from('site_members')
    .select('id, site_id, invited_email, status')
    .eq('invite_token', token)
    .eq('site_id', siteId)
    .single();

  if (!member) return NextResponse.redirect(`${appUrl}/laruHP/dashboard?invite=invalid`);
  if (member.status === 'active') return NextResponse.redirect(`${appUrl}/laruHP/dashboard?invite=already`);

  // Activate membership
  await service
    .from('site_members')
    .update({ user_id: user.id, status: 'active', invite_token: null })
    .eq('id', member.id);

  return NextResponse.redirect(`${appUrl}/laruHP/dashboard?invite=success`);
}
