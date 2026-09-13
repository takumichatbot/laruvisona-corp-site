import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { siteMemberSiteId, siteMemberToken } from '@/lib/site-member-contract';

type Params = { params: Promise<{ id: string }> };

function destination(path: string) {
  return new URL(path, process.env.NEXT_PUBLIC_APP_URL || 'https://laruvisona.jp');
}

export async function GET(req: Request, { params }: Params) {
  let siteId: string, token: string;
  try {
    siteId = siteMemberSiteId((await params).id);
    token = siteMemberToken(new URL(req.url).searchParams.get('token'));
  } catch { return NextResponse.redirect(destination('/laruHP/dashboard?invite=invalid')); }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(destination(`/laruHP/auth/login?redirect=${encodeURIComponent(`/laruHP/invite/${token}`)}`));
  }
  const userEmail = user.email?.trim().toLowerCase();
  if (!userEmail) return NextResponse.redirect(destination('/laruHP/dashboard?invite=email-required'));

  const service = await createServiceClient();
  const { data: member, error: lookupError } = await service.from('site_members')
    .select('id, invited_email').eq('invite_token', token).eq('site_id', siteId)
    .eq('status', 'pending').gt('invite_expires_at', new Date().toISOString()).maybeSingle();
  if (lookupError || !member) return NextResponse.redirect(destination('/laruHP/dashboard?invite=invalid'));
  if (member.invited_email !== userEmail) return NextResponse.redirect(destination('/laruHP/dashboard?invite=email-mismatch'));

  const { data: activated, error } = await service.from('site_members')
    .update({ user_id: user.id, status: 'active', invite_token: null, invite_expires_at: null })
    .eq('id', member.id).eq('site_id', siteId).eq('invite_token', token).eq('status', 'pending')
    .select('id');
  if (error || activated?.length !== 1) return NextResponse.redirect(destination('/laruHP/dashboard?invite=conflict'));
  return NextResponse.redirect(destination('/laruHP/dashboard?invite=success'));
}
