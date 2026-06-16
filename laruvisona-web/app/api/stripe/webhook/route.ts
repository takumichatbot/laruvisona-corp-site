import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createServiceClient } from '@/lib/supabase/server';
import type Stripe from 'stripe';

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature')!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabase = await createServiceClient();

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== 'subscription') break;
      const userId = (session.metadata as Record<string,string> | null)?.supabase_user_id;
      if (!userId) break;

      const contractStart = new Date();
      const contractEnd = new Date();
      contractEnd.setMonth(contractEnd.getMonth() + 6);

      await supabase.from('profiles').update({
        stripe_subscription_id: session.subscription as string,
        subscription_status: 'active',
        contract_starts_at: contractStart.toISOString(),
        contract_ends_at: contractEnd.toISOString(),
      }).eq('id', userId);
      break;
    }

    case 'invoice.payment_succeeded': {
      const inv = event.data.object as unknown as Record<string, unknown>;
      const subId = (typeof inv['subscription'] === 'string' ? inv['subscription'] : (inv['subscription'] as { id?: string } | null)?.id) ?? (inv['subscription_id'] as string | null);
      if (!subId) break;

      await supabase.from('profiles')
        .update({ subscription_status: 'active' })
        .eq('stripe_subscription_id', subId);
      break;
    }

    case 'invoice.payment_failed': {
      const inv = event.data.object as unknown as Record<string, unknown>;
      const subId = (typeof inv['subscription'] === 'string' ? inv['subscription'] : (inv['subscription'] as { id?: string } | null)?.id) ?? (inv['subscription_id'] as string | null);
      if (!subId) break;

      await supabase.from('profiles')
        .update({ subscription_status: 'past_due' })
        .eq('stripe_subscription_id', subId);
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      await supabase.from('profiles')
        .update({ subscription_status: 'canceled', stripe_subscription_id: null })
        .eq('stripe_subscription_id', sub.id);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
