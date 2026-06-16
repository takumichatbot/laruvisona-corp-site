import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id, contract_ends_at, subscription_status')
    .eq('id', user.id)
    .single();

  if (!profile?.stripe_customer_id) {
    return NextResponse.json({ error: 'No subscription found' }, { status: 404 });
  }

  // Enforce 6-month minimum contract
  if (profile.contract_ends_at && profile.subscription_status === 'active') {
    const contractEnd = new Date(profile.contract_ends_at);
    if (contractEnd > new Date()) {
      return NextResponse.json({
        error: 'minimum_contract',
        message: `最低契約期間中のため解約できません。解約可能日: ${contractEnd.toLocaleDateString('ja-JP')}`,
        contract_ends_at: profile.contract_ends_at,
      }, { status: 403 });
    }
  }

  const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL;
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${origin}/laruHP/dashboard`,
  });

  return NextResponse.json({ url: portalSession.url });
}
