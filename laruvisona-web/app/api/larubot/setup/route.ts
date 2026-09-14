import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { readContactBody } from '@/lib/contact-contract';
import { claimPublicRate } from '@/lib/public-rate-limit';

type LarubotPlan = 'lite' | 'starter' | 'pro' | 'laru-cloud';
const VALID_PLANS: LarubotPlan[] = ['lite', 'starter', 'pro', 'laru-cloud'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  let body: Record<string, unknown>;
  try { body = await readContactBody(req, 10_000); }
  catch { return NextResponse.json({ error: '入力を確認してください' }, { status: 400 }); }
  if (Object.keys(body).some(key => !['site_id', 'plan', 'client_email'].includes(key))) {
    return NextResponse.json({ error: '入力を確認してください' }, { status: 400 });
  }
  const { site_id, plan, client_email } = body;
  if (typeof site_id !== 'string' || !UUID.test(site_id)) return NextResponse.json({ error: 'site_id required' }, { status: 400 });
  if (typeof plan !== 'string' || !VALID_PLANS.includes(plan as LarubotPlan)) {
    return NextResponse.json({ error: 'invalid plan' }, { status: 400 });
  }
  if (client_email != null && client_email !== '' && (typeof client_email !== 'string' || client_email.length > 254 || !EMAIL.test(client_email))) {
    return NextResponse.json({ error: 'invalid email' }, { status: 400 });
  }

  const rate = await claimPublicRate(createServiceClient(), 'larubot-setup', `${user.id}:${site_id}`, 1, 60);
  if (rate !== 'allowed') return NextResponse.json({ error: rate === 'limited' ? '少し待ってからお試しください' : '登録受付を確認できません' }, { status: rate === 'limited' ? 429 : 503 });

  // Verify site belongs to this user
  const { data: site, error: siteError } = await supabase
    .from('sites')
    .select('id, name')
    .eq('id', site_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (siteError) return NextResponse.json({ error: 'site lookup failed' }, { status: 503 });
  if (!site) return NextResponse.json({ error: 'site not found' }, { status: 404 });

  if (!process.env.LARU_HP_API_SECRET) {
    return NextResponse.json({ error: 'LARUbot not configured' }, { status: 500 });
  }

  try {
    const larubotBase = new URL(process.env.LARUBOT_API_URL || 'https://larubot.tokyo');
    if (larubotBase.protocol !== 'https:' || larubotBase.username || larubotBase.password) throw Error('invalid base');
    const res = await fetch(new URL('/api/hp/register', larubotBase), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-laru-secret': process.env.LARU_HP_API_SECRET,
      },
      body: JSON.stringify({
        email: client_email || user.email,
        plan,
        site_name: site.name,
        user_id: user.id,
        site_id,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      await res.body?.cancel();
      console.error('[larubot/setup] LARUbot error:', res.status);
      return NextResponse.json({ error: 'LARUbot registration failed' }, { status: 502 });
    }

    await res.body?.cancel();

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[larubot/setup] fetch error:', err);
    return NextResponse.json({ error: 'network error' }, { status: 500 });
  }
}
