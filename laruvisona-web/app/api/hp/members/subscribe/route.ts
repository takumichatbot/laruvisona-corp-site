import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { verifyMemberToken } from '@/lib/member-auth';

export const dynamic = 'force-dynamic';

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(req: Request) {
  const { siteId, token, priceId, returnUrl } = await req.json().catch(() => ({}));
  if (!siteId || !token || !priceId) return NextResponse.json({ error: 'パラメータが不足しています' }, { status: 400 });
  if (!process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: '決済が設定されていません' }, { status: 500 });

  const payload = verifyMemberToken(token);
  if (!payload || payload.sid !== siteId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 });

  const supabase = admin();
  const { data: member } = await supabase.from('hp_members').select('id, email, stripe_customer_id').eq('id', payload.mid).eq('site_id', siteId).maybeSingle();
  if (!member) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 });

  const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || '';
  const base = (returnUrl || origin || 'https://laruvisona.jp/').split('?')[0];

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      ...(member.stripe_customer_id ? { customer: member.stripe_customer_id } : { customer_email: member.email }),
      metadata: { kind: 'member', member_id: member.id, site_id: siteId },
      subscription_data: { metadata: { kind: 'member', member_id: member.id, site_id: siteId } },
      success_url: `${base}?member=upgraded`,
      cancel_url: `${base}?member=canceled`,
      locale: 'ja',
    });
    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const e = err as { message?: string; code?: string };
    console.error('[members/subscribe] error:', e?.code, e?.message);
    return NextResponse.json({ error: e?.message || '決済の開始に失敗しました' }, { status: 500 });
  }
}
