import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

// GET /api/referral/stats
// Returns referral stats for the authenticated user.
// referral code = first 8 chars of user.id
// referral link = https://laruvisona.jp/laruHP/r/{code}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://laruvisona.jp';
const COMMISSION_RATE = 0.20; // 20% of monthly fee

const PLAN_PRICES: Record<string, number> = {
  hp: 999, lite: 4980, 'hp-bot': 4980, 'hp-bot-seo': 9800, agency: 19800,
};

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const referralCode = user.id.slice(0, 8);
  const referralUrl = `${APP_URL}/laruHP/r/${referralCode}`;

  // Find profiles that were referred by this user
  const service = await createServiceClient();
  const { data: referrals } = await service
    .from('profiles')
    .select('id, plan, subscription_status, created_at')
    .eq('referred_by', user.id)
    .order('created_at', { ascending: false });

  const list = (referrals || []).map(r => ({
    id: r.id.slice(0, 8),
    plan: r.plan,
    status: r.subscription_status,
    joinedAt: r.created_at,
    monthlyFee: PLAN_PRICES[r.plan || 'hp'] || 999,
    commission: Math.floor((PLAN_PRICES[r.plan || 'hp'] || 999) * COMMISSION_RATE),
  }));

  const activeReferrals = list.filter(r => r.status === 'active');
  const totalCommission = activeReferrals.reduce((sum, r) => sum + r.commission, 0);
  const pendingCommission = list.filter(r => r.status !== 'active').reduce((sum, r) => sum + r.commission, 0);

  return NextResponse.json({
    referralCode,
    referralUrl,
    total: list.length,
    active: activeReferrals.length,
    totalCommissionMonthly: totalCommission,
    pendingCommission,
    referrals: list,
  });
}
