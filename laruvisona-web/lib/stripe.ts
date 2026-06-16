import Stripe from 'stripe';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-05-27.dahlia',
      typescript: true,
    });
  }
  return _stripe;
}

// convenience alias used by existing imports
export const stripe = new Proxy({} as Stripe, {
  get(_t, prop) {
    return (getStripe() as unknown as Record<string, unknown>)[prop as string];
  },
});

export const PLAN = {
  priceId: process.env.STRIPE_PRICE_ID!,
  amount: 999,
  currency: 'jpy',
  firstMonthAmount: 1,
  minimumMonths: 6,
};
