import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { verifyMemberToken } from '@/lib/member-auth';
import { collectPriceIds } from '@/lib/site-blocks';
import { safeReturnUrl } from '@/lib/site-origin';

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

  const { data: site } = await supabase
    .from('sites')
    .select('blocks_json, slug, custom_domain')
    .eq('id', siteId)
    .eq('published', true)
    .single();
  if (!site) return NextResponse.json({ error: 'サイトが見つかりません' }, { status: 404 });

  // 価格はサイト側の設定にあるものだけ。クライアントの priceId をそのまま
  // Stripe に渡すと、会員が任意の（安い・無料の）価格で購読して
  // webhook 側の「kind=member なら有料化」を通過できてしまう。
  const allowedPrices = collectPriceIds(site.blocks_json, 'member-gate');
  if (!allowedPrices.has(String(priceId))) {
    return NextResponse.json({ error: 'この価格は利用できません' }, { status: 400 });
  }

  const base = safeReturnUrl(returnUrl, req.headers.get('origin'), site);

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const price = await stripe.prices.retrieve(String(priceId));
    // 月額会員なので recurring 以外は受け付けない（買い切り価格での購読を防ぐ）
    if (!price.recurring || price.active === false) {
      return NextResponse.json({ error: 'この価格は月額購読に使えません' }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: String(priceId), quantity: 1 }],
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
    return NextResponse.json({ error: '決済の開始に失敗しました' }, { status: 500 });
  }
}
