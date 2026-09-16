import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireBearer } from '@/lib/scheduled-email';
import { stripe } from '@/lib/stripe';
import { MONTHLY, ANNUAL_TOTAL } from '@/lib/laruhp-facts';
import { verifyFirstMonthCoupon } from '@/lib/price-integrity';

export const dynamic = 'force-dynamic';

/**
 * 画面に出している料金と、Stripeが実際に請求する額が合っているかを見る。
 *
 * ここが食い違うと、出荷手順の停止条件そのもの（release-plan の
 * 「画面の料金とStripe Priceの金額が一致しない」）に当たる。目で照らし合わせる
 * 作業は必ず抜けるので、読み取りだけの口にして機械に数えさせる。
 *
 * 読むだけで、Stripeにも DBにも書かない。
 */
const PLANS = [
  { plan: 'hp',         label: 'LARU HP',            monthlyEnv: 'STRIPE_PRICE_ID',             annualEnv: 'STRIPE_HP_ANNUAL_PRICE_ID',      monthly: MONTHLY.hp,       annual: ANNUAL_TOTAL.hp },
  { plan: 'lite',       label: 'Lite',               monthlyEnv: 'STRIPE_LITE_PRICE_ID',        annualEnv: 'STRIPE_LITE_ANNUAL_PRICE_ID',    monthly: MONTHLY.lite,     annual: ANNUAL_TOTAL.lite },
  { plan: 'hp-bot',     label: 'HP + LARUbot',       monthlyEnv: 'STRIPE_BUNDLE_BOT_PRICE_ID',  annualEnv: 'STRIPE_BOT_ANNUAL_PRICE_ID',     monthly: MONTHLY.hpBot,    annual: ANNUAL_TOTAL.hpBot },
  { plan: 'hp-bot-seo', label: 'HP + Bot + SEO',     monthlyEnv: 'STRIPE_BUNDLE_FULL_PRICE_ID', annualEnv: 'STRIPE_FULL_ANNUAL_PRICE_ID',    monthly: MONTHLY.hpBotSeo, annual: ANNUAL_TOTAL.hpBotSeo },
  { plan: 'agency',     label: 'エージェンシー',       monthlyEnv: 'STRIPE_AGENCY_PRICE_ID',      annualEnv: 'STRIPE_AGENCY_ANNUAL_PRICE_ID',  monthly: MONTHLY.agency,   annual: ANNUAL_TOTAL.agency },
] as const;

type Row = {
  plan: string; billing: 'monthly' | 'annual'; shown: number;
  stripe: number | null; currency: string | null; interval: string | null;
  priceId: string | null; status: 'ok' | 'mismatch' | 'unset' | 'unreadable';
  note?: string;
};

async function allowed(req: Request): Promise<boolean> {
  if (requireBearer(req, process.env.ADMIN_SECRET)) return true;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const admin = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    return !!admin && (user?.email || '').trim().toLowerCase() === admin;
  } catch { return false; }
}

async function check(
  plan: string, billing: 'monthly' | 'annual', envName: string, shown: number,
): Promise<Row> {
  const priceId = process.env[envName];
  if (!priceId) {
    return { plan, billing, shown, stripe: null, currency: null, interval: null, priceId: null,
      status: 'unset', note: `${envName} が設定されていません` };
  }
  try {
    const price = await stripe.prices.retrieve(priceId);
    const amount = price.unit_amount ?? null;
    const interval = price.recurring?.interval ?? null;
    const wantInterval = billing === 'monthly' ? 'month' : 'year';
    const same = amount === shown && price.currency === 'jpy' && interval === wantInterval;
    return {
      plan, billing, shown, stripe: amount, currency: price.currency, interval, priceId,
      status: same ? 'ok' : 'mismatch',
      ...(same ? {} : { note: amount !== shown
        ? `画面は ${shown} 円、Stripeは ${amount} 円`
        : `通貨または請求間隔が違います（${price.currency} / ${interval}）` }),
    };
  } catch (error) {
    // 環境（test/live）違いの価格IDはここで 404 になる。
    return { plan, billing, shown, stripe: null, currency: null, interval: null, priceId,
      status: 'unreadable', note: (error as Error)?.message?.slice(0, 160) || '読み取れません' };
  }
}

export async function GET(req: Request) {
  if (!await allowed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows: Row[] = [];
  for (const p of PLANS) {
    rows.push(await check(p.plan, 'monthly', p.monthlyEnv, p.monthly));
    rows.push(await check(p.plan, 'annual', p.annualEnv, p.annual));
  }

  const problems = rows.filter(r => r.status !== 'ok');

  // 「初月無料」はクーポン1枚で全プランに出している。割合100%でないと、
  // 高いプランでは初月が無料にならない。set/未設定だけでは足りない。
  const couponId = process.env.STRIPE_FIRST_MONTH_COUPON_ID;
  let firstMonthCoupon: Record<string, unknown>;
  if (!couponId) {
    firstMonthCoupon = { status: 'MISSING', note: '月払いの決済が全部503になります' };
  } else {
    try {
      const coupon = await stripe.coupons.retrieve(couponId);
      const perPlan = PLANS.map(p => {
        const verdict = verifyFirstMonthCoupon(p.plan, coupon);
        return { plan: p.plan, ok: verdict.ok, reason: verdict.ok ? undefined : verdict.reason };
      });
      firstMonthCoupon = {
        status: perPlan.every(x => x.ok) ? 'ok' : 'MISMATCH',
        percentOff: coupon.percent_off ?? null,
        amountOff: coupon.amount_off ?? null,
        duration: coupon.duration ?? null,
        perPlan: perPlan.filter(x => !x.ok),
      };
    } catch (err) {
      firstMonthCoupon = { status: 'unreadable', note: (err as Error)?.message };
    }
  }

  return NextResponse.json({
    ok: problems.length === 0 && firstMonthCoupon.status === 'ok',
    firstMonthCoupon,
    problems,
    rows,
  });
}
