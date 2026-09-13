import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { verifyMemberToken } from '@/lib/member-auth';
import { safeReturnUrl } from '@/lib/site-origin';
import { parseHpMemberPortal, readHpMemberBody } from '@/lib/hp-member-contract';

export const dynamic = 'force-dynamic';

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(req: Request) {
  let input;
  try { input = parseHpMemberPortal(await readHpMemberBody(req)); }
  catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }
  const { siteId, token, returnUrl } = input;
  if (!process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: '決済が設定されていません' }, { status: 500 });

  const payload = verifyMemberToken(token);
  if (!payload || payload.sid !== siteId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 });

  const supabase = admin();
  const { data: member, error: memberError } = await supabase.from('hp_members').select('stripe_customer_id, status').eq('id', payload.mid).eq('site_id', siteId).maybeSingle();
  if (memberError) return NextResponse.json({ error: '会員状態を確認できませんでした' }, { status: 500 });
  if (member?.status !== 'active') return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 });
  if (!member?.stripe_customer_id) return NextResponse.json({ error: 'お支払い情報がありません' }, { status: 400 });

  const { data: site, error: siteError } = await supabase.from('sites').select('slug, custom_domain').eq('id', siteId).eq('published', true).maybeSingle();
  if (siteError) return NextResponse.json({ error: 'サイトを確認できませんでした' }, { status: 500 });
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
