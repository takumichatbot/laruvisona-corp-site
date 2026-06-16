import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { siteId } = await req.json().catch(() => ({}));
  const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL;

  // Get or create Stripe customer
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id, business_name')
    .eq('id', user.id)
    .single();

  let customerId = profile?.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: profile?.business_name || user.email,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;
    await supabase.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
  }

  // Create checkout session (999円/月, 初月1円クーポン)
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: process.env.STRIPE_PRICE_ID!,
        quantity: 1,
      },
    ],
    discounts: process.env.STRIPE_FIRST_MONTH_COUPON_ID
      ? [{ coupon: process.env.STRIPE_FIRST_MONTH_COUPON_ID }]
      : [],
    subscription_data: {
      metadata: {
        supabase_user_id: user.id,
        site_id: siteId || '',
        contract_months: '6',
      },
    },
    success_url: `${origin}/laruHP/dashboard?payment=success`,
    cancel_url: `${origin}/laruHP?payment=canceled`,
    locale: 'ja',
  });

  return NextResponse.json({ url: session.url });
}
