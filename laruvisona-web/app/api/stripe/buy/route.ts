import { NextResponse } from 'next/server';
import Stripe from 'stripe';

export async function POST(req: Request) {
  const { priceId, siteUrl } = await req.json() as { priceId: string; siteUrl: string };
  if (!priceId) return NextResponse.json({ error: 'priceId required' }, { status: 400 });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: siteUrl || `${process.env.NEXT_PUBLIC_APP_URL}/`,
    cancel_url: siteUrl || `${process.env.NEXT_PUBLIC_APP_URL}/`,
  });

  return NextResponse.json({ url: session.url });
}
