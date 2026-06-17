import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

async function isAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  return user.email === process.env.ADMIN_EMAIL;
}

const PLAN_PRICE: Record<string, number> = {
  'hp': 999,
  'hp-bot': 4980,
  'hp-bot-seo': 9800,
};

export async function GET() {
  const supabase = await createClient();
  if (!await isAdmin(supabase)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const service = await createServiceClient();

  const [
    { count: totalUsers },
    { count: pastDueUsers },
    { count: totalSites },
    { count: publishedSites },
    { data: activeProfiles },
  ] = await Promise.all([
    service.from('profiles').select('*', { count: 'exact', head: true }),
    service.from('profiles').select('*', { count: 'exact', head: true }).eq('subscription_status', 'past_due'),
    service.from('sites').select('*', { count: 'exact', head: true }),
    service.from('sites').select('*', { count: 'exact', head: true }).eq('published', true),
    service.from('profiles').select('plan').eq('subscription_status', 'active'),
  ]);

  const planBreakdown: Record<string, number> = { hp: 0, 'hp-bot': 0, 'hp-bot-seo': 0 };
  let mrr = 0;
  for (const p of activeProfiles || []) {
    const plan = (p.plan as string) || 'hp';
    planBreakdown[plan] = (planBreakdown[plan] || 0) + 1;
    mrr += PLAN_PRICE[plan] || 999;
  }

  return NextResponse.json({
    totalUsers: totalUsers ?? 0,
    activeUsers: (activeProfiles || []).length,
    pastDueUsers: pastDueUsers ?? 0,
    totalSites: totalSites ?? 0,
    publishedSites: publishedSites ?? 0,
    mrr,
    planBreakdown,
  });
}
