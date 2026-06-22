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
  'agency': 19800,
  'lite': 4980,
};

export async function GET() {
  const supabase = await createClient();
  if (!await isAdmin(supabase)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const service = await createServiceClient();

  const THIRTY_DAYS_AGO = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const [
    { count: totalUsers },
    { count: pastDueUsers },
    { count: totalSites },
    { count: publishedSites },
    { data: activeProfiles },
    { data: allSites },
    { data: recentContacts },
  ] = await Promise.all([
    service.from('profiles').select('*', { count: 'exact', head: true }),
    service.from('profiles').select('*', { count: 'exact', head: true }).eq('subscription_status', 'past_due'),
    service.from('sites').select('*', { count: 'exact', head: true }),
    service.from('sites').select('*', { count: 'exact', head: true }).eq('published', true),
    service.from('profiles').select('id, plan, contract_starts_at').eq('subscription_status', 'active'),
    service.from('sites').select('id, user_id, published, updated_at'),
    service.from('contacts').select('site_id').gte('created_at', THIRTY_DAYS_AGO),
  ]);

  const planBreakdown: Record<string, number> = { hp: 0, 'hp-bot': 0, 'hp-bot-seo': 0, agency: 0, lite: 0 };
  let mrr = 0;
  for (const p of activeProfiles || []) {
    const plan = (p.plan as string) || 'hp';
    planBreakdown[plan] = (planBreakdown[plan] || 0) + 1;
    mrr += PLAN_PRICE[plan] || 999;
  }

  // Churn risk: active users with no published site OR no activity in 30 days
  type SiteRow = { id: string; user_id: string; published: boolean; updated_at: string };
  const sitesByUser = (allSites as SiteRow[] || []).reduce<Record<string, SiteRow[]>>(
    (acc, s) => { acc[s.user_id] = [...(acc[s.user_id] || []), s]; return acc; }, {}
  );
  const contactSiteIds = new Set((recentContacts || []).map(c => c.site_id));
  const siteIds = new Set((allSites as SiteRow[] || []).map(s => s.id));
  const activeUserIds = new Set((activeProfiles || []).map(p => p.id));

  const churnRisk = (activeProfiles || [])
    .map(p => {
      const userSites = sitesByUser[p.id] || [];
      const hasPublished = userSites.some(s => s.published);
      const hasRecentContact = userSites.some(s => contactSiteIds.has(s.id));
      const lastActive = userSites.length > 0
        ? Math.max(...userSites.map(s => new Date(s.updated_at).getTime()))
        : new Date(p.contract_starts_at || 0).getTime();
      const daysSinceActive = Math.floor((Date.now() - lastActive) / 86_400_000);

      let score = 0; // 0=healthy, higher=riskier
      if (!hasPublished) score += 40;
      if (daysSinceActive > 14) score += 30;
      if (!hasRecentContact) score += 20;
      if (userSites.length === 0) score += 10;

      return {
        id: p.id,
        plan: p.plan,
        score,
        hasPublished,
        hasRecentContact,
        daysSinceActive,
        siteCount: userSites.length,
      };
    })
    .filter(p => p.score >= 40)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  void siteIds; void activeUserIds;

  return NextResponse.json({
    totalUsers: totalUsers ?? 0,
    activeUsers: (activeProfiles || []).length,
    pastDueUsers: pastDueUsers ?? 0,
    totalSites: totalSites ?? 0,
    publishedSites: publishedSites ?? 0,
    mrr,
    planBreakdown,
    churnRisk,
  });
}
