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

      const meta = (session.metadata || {}) as Record<string, string>;
      const userId = meta.supabase_user_id;
      const siteId = meta.site_id;
      const plan = meta.plan;
      if (!userId) break;

      // Adminはサブスク管理をスキップ（課金なしで全機能利用）
      const { data: { user: adminCheck } } = await supabase.auth.admin.getUserById(userId);
      if (adminCheck?.email === process.env.ADMIN_EMAIL) break;

      const contractStart = new Date();
      const contractEnd = new Date();
      contractEnd.setMonth(contractEnd.getMonth() + 6);

      await supabase.from('profiles').update({
        stripe_subscription_id: session.subscription as string,
        subscription_status: 'active',
        plan: plan || 'hp',
        contract_starts_at: contractStart.toISOString(),
        contract_ends_at: contractEnd.toISOString(),
      }).eq('id', userId);

      // Auto-create LARUbot account for bundle plans
      if ((plan === 'hp-bot' || plan === 'hp-bot-seo') && process.env.LARU_HP_API_SECRET) {
        try {
          const { data: { user } } = await supabase.auth.admin.getUserById(userId);
          let siteName = '';
          if (siteId) {
            const { data: site } = await supabase
              .from('sites')
              .select('name')
              .eq('id', siteId)
              .single();
            siteName = site?.name || '';
          }

          const larubot_base = process.env.LARUBOT_API_URL || 'https://larubot.tokyo';
          await fetch(`${larubot_base}/api/hp/register`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-laru-secret': process.env.LARU_HP_API_SECRET,
            },
            body: JSON.stringify({
              email: user?.email,
              plan,
              site_name: siteName,
              user_id: userId,
              site_id: siteId || '',
            }),
          });
        } catch (err) {
          console.error('[LARUbot register] failed:', err);
          // Non-fatal: LARUbot will retry or callback handles public_id later
        }
      }
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

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const subMeta = (sub.metadata || {}) as Record<string, string>;
      const updatedPlan = subMeta['plan'];
      const statusMap: Record<string, string> = {
        active: 'active',
        past_due: 'past_due',
        canceled: 'canceled',
        unpaid: 'past_due',
        trialing: 'active',
      };
      const updates: Record<string, unknown> = {
        subscription_status: statusMap[sub.status] || sub.status,
      };
      if (updatedPlan) updates['plan'] = updatedPlan;
      await supabase.from('profiles').update(updates).eq('stripe_subscription_id', sub.id);
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      await supabase.from('profiles')
        .update({ subscription_status: 'canceled', stripe_subscription_id: null, plan: null })
        .eq('stripe_subscription_id', sub.id);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
