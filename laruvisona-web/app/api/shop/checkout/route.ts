import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import Stripe from 'stripe';

// POST /api/shop/checkout — create Stripe Checkout for a product
// Public endpoint (customers buying from published shop)
export async function POST(req: Request) {
  const { siteId, productId, successUrl, cancelUrl } = await req.json() as {
    siteId: string;
    productId: string;
    successUrl: string;
    cancelUrl: string;
  };

  if (!siteId || !productId) {
    return NextResponse.json({ error: 'siteId and productId required' }, { status: 400 });
  }

  const service = await createServiceClient();
  const { data: site } = await service.from('sites').select('name, settings_json').eq('id', siteId).single();
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  const settings = (site.settings_json as Record<string, unknown>) || {};
  const products = (settings.products as Array<{
    id: string; name: string; description: string; price: number;
    images: string[]; active: boolean;
  }>) || [];

  const product = products.find(p => p.id === productId && p.active);
  if (!product) return NextResponse.json({ error: 'Product not found or inactive' }, { status: 404 });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  const stripeProduct = await stripe.products.create({
    name: product.name,
    description: product.description || undefined,
    images: product.images.slice(0, 8),
    metadata: { laru_site_id: siteId, laru_product_id: productId },
  });

  const stripePrice = await stripe.prices.create({
    product: stripeProduct.id,
    unit_amount: product.price,
    currency: 'jpy',
  });

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price: stripePrice.id, quantity: 1 }],
    success_url: successUrl || `${process.env.NEXT_PUBLIC_APP_URL}/?payment=success`,
    cancel_url: cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL}/`,
    locale: 'ja',
    metadata: {
      laru_site_id: siteId,
      laru_product_id: productId,
      laru_product_name: product.name,
    },
  });

  return NextResponse.json({ url: session.url });
}
