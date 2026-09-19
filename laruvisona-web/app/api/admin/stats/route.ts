import { NextResponse } from 'next/server';
import { isAdminEmail } from '@/lib/adminAuth';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { fetchStripeTruth } from '@/lib/stripe-truth';

async function isAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  return isAdminEmail(user.email);
}

/*
  ⚠️ **金額の正はここではない。Stripeの契約が正。**

  2026-09-18まで、MRRはこの表を profiles の件数に掛けて出していた。
  Stripeを一度も見ていなかったので、Stripeのサンドボックスから
  紛れ込んだ1行のせいで、実売上0円のまま「MRR ¥999」と出続けた。

  この表はもう金額には使わない。プラン名の並び順を決めるためだけに残す。
  （ここの数字と Stripe の請求額が合っているかは
    /api/admin/price-check が別に見ている）
*/
const PLAN_ORDER = ['hp', 'lite', 'hp-bot', 'hp-bot-seo', 'agency'] as const;

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
    /*
      trialing も数える。lib/subscription-reconcile.ts が profiles に trialing を書き、
      lib/stripe-truth.ts も active/trialing を「課金が生きている契約」としているのに、
      ここだけ active しか見ていなかった（2026-09-19 に確認）。
      試用中の人が、契約数にも食い違いの表にも出なかった。
    */
    service.from('profiles').select('id, plan, contract_starts_at, stripe_subscription_id').in('subscription_status', ['active', 'trialing']),
    service.from('sites').select('id, user_id, published, updated_at'),
    service.from('contacts').select('site_id').gte('created_at', THIRTY_DAYS_AGO),
  ]);

  /*
    契約と売上は **Stripe を正として数える。**

    profiles に active と書いてあっても、Stripe にその契約が無ければ数えない。
    （2026-09-18: サンドボックスの契約が本番の profiles に入り込んでいた）

    ⚠️ Stripe に聞けなかったときは、DBの数字を正しい数字として出さない。
       mrr は 0 にして stripe.ok=false を返し、画面は「確認できません」と出す。
       ここでDBの数字を返すと、また同じ嘘が静かに戻る。
  */
  const truth = await fetchStripeTruth();

  const planBreakdown: Record<string, number> = { hp: 0, 'hp-bot': 0, 'hp-bot-seo': 0, agency: 0, lite: 0 };
  for (const key of PLAN_ORDER) planBreakdown[key] = planBreakdown[key] ?? 0;

  /** profiles が active と言っているのに、Stripeに課金中の契約が無い人 */
  const unverified: { id: string; plan: string | null; reason: string }[] = [];
  let mrr = 0;
  let verifiedCount = 0;

  if (truth.ok) {
    for (const p of activeProfiles || []) {
      const subId = (p.stripe_subscription_id as string | null) || null;
      const live = subId ? truth.billable.get(subId) : undefined;
      if (!live) {
        unverified.push({
          id: p.id as string,
          plan: (p.plan as string) ?? null,
          reason: !subId ? 'no_subscription_id'
            : truth.all.has(subId) ? `stripe_status_${truth.all.get(subId)!.status}`
            : 'not_in_stripe',
        });
        continue;
      }
      verifiedCount += 1;
      // 金額は Stripe の実際の請求額。固定表は使わない。
      mrr += live.monthlyAmount;
      const plan = (p.plan as string) || 'hp';
      planBreakdown[plan] = (planBreakdown[plan] || 0) + 1;
    }
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
    // Stripeで確かめられた契約だけを「稼働中」として数える
    activeUsers: truth.ok ? verifiedCount : 0,
    /** DBがactiveと言っている数（照合前）。食い違いを見るためだけに出す。 */
    activeProfilesInDb: (activeProfiles || []).length,
    stripe: {
      ok: truth.ok,
      ...(truth.ok ? {} : { reason: truth.reason ?? 'unknown' }),
      unverified,
    },
    pastDueUsers: pastDueUsers ?? 0,
    totalSites: totalSites ?? 0,
    publishedSites: publishedSites ?? 0,
    mrr,
    planBreakdown,
    churnRisk,
  });
}
