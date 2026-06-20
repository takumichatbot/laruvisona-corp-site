import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';

type LarubotPlan = 'lite' | 'starter' | 'pro' | 'laru-cloud';
const VALID_PLANS: LarubotPlan[] = ['lite', 'starter', 'pro', 'laru-cloud'];

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isAdmin = !!process.env.NEXT_PUBLIC_ADMIN_EMAIL && user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;

  if (!isAdmin) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan, stripe_customer_id')
      .eq('id', user.id)
      .single();
    if (profile?.plan !== 'agency') {
      return NextResponse.json({ error: 'agency_plan_required' }, { status: 403 });
    }
  }

  const { site_id, plan, client_email } = await req.json().catch(() => ({}));
  if (!site_id) return NextResponse.json({ error: 'site_id required' }, { status: 400 });
  if (!VALID_PLANS.includes(plan)) {
    return NextResponse.json({ error: 'invalid plan' }, { status: 400 });
  }

  // Verify site belongs to this user
  const { data: site } = await supabase
    .from('sites')
    .select('id, name')
    .eq('id', site_id)
    .eq('user_id', user.id)
    .single();
  if (!site) return NextResponse.json({ error: 'site not found' }, { status: 404 });

  if (!process.env.LARU_HP_API_SECRET) {
    return NextResponse.json({ error: 'LARUbot not configured' }, { status: 500 });
  }

  try {
    const larubot_base = process.env.LARUBOT_API_URL || 'https://larubot.tokyo';
    const res = await fetch(`${larubot_base}/api/hp/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-laru-secret': process.env.LARU_HP_API_SECRET,
      },
      body: JSON.stringify({
        email: client_email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client_email) ? client_email : user.email,
        plan,
        site_name: site.name,
        user_id: user.id,
        site_id,
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      console.error('[larubot/setup] LARUbot error:', res.status, err);
      return NextResponse.json({ error: 'LARUbot registration failed' }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[larubot/setup] fetch error:', err);
    return NextResponse.json({ error: 'network error' }, { status: 500 });
  }
}
