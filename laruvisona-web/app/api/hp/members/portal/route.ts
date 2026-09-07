import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { verifyMemberToken } from '@/lib/member-auth';
import { safeReturnUrl } from '@/lib/site-origin';

export const dynamic = 'force-dynamic';

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(req: Request) {
  const { siteId, token, returnUrl } = await req.json().catch(() => ({}));
  if (!siteId || !token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: '決済が設定されていません' }, { status: 500 });

  const payload = verifyMemberToken(token);
  if (!payload || payload.sid !== siteId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 });

  const supabase = admin();
  const { data: member } = await supabase.from('hp_members').select('stripe_customer_id').eq('id', payload.mid).eq('site_id', siteId).maybeSingle();
  if (!member?.stripe_customer_id) return NextResponse.json({ error: 'お支払い情報がありません' }, { status: 400 });

  const { data: site } = await supabase.from('sites').select('slug, custom_domain').eq('id', siteId).single();
  if (!site) return NextResponse.json({ error: 'サイトが見つかりません' }, { status: 404 });

  // 戻り先はそのサイトの正当なホストのみ。クライアントの returnUrl を
  // そのまま渡すと、決済画面から任意のドメインへ飛ばせてしまう。
  const returnTo = safeReturnUrl(returnUrl, req.headers.get('origin'), site);
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.billingPortal.sessions.create({
      customer: member.stripe_customer_id,
      return_url: returnTo,
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error('[members/portal] error:', (e as Error)?.message);
    return NextResponse.json({ error: 'お支払い管理を開けませんでした' }, { status: 500 });
  }
}
