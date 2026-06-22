import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';

// POST /api/stripe/payment-link
// Creates a Stripe Payment Link for embedding in published sites
// body: { siteId, amount, description, buttonText, currency? }

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { siteId, amount, description, buttonText, currency = 'jpy' } = await req.json() as {
    siteId: string;
    amount: number;
    description: string;
    buttonText?: string;
    currency?: string;
  };

  if (!siteId || !amount || !description) {
    return NextResponse.json({ error: 'siteId, amount, description required' }, { status: 400 });
  }

  if (amount < 50) {
    return NextResponse.json({ error: '最低金額は50円です' }, { status: 400 });
  }

  // Verify site ownership
  const { data: site } = await supabase
    .from('sites')
    .select('id, name, user_id')
    .eq('id', siteId)
    .eq('user_id', user.id)
    .single();

  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  try {
    // Create Stripe product + price + payment link
    const product = await stripe.products.create({
      name: description,
      metadata: { siteId, userId: user.id },
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: amount,
      currency,
    });

    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: { siteId, userId: user.id },
      after_completion: {
        type: 'redirect',
        redirect: { url: `${process.env.NEXT_PUBLIC_APP_URL}/laruHP/dashboard?payment=success` },
      },
    });

    // Save payment link to site's payment_links array in settings_json
    const { data: existing } = await supabase
      .from('sites')
      .select('settings_json')
      .eq('id', siteId)
      .single();

    const settings = (existing?.settings_json as Record<string, unknown>) || {};
    const paymentLinks = (settings.payment_links as Array<{
      id: string;
      url: string;
      amount: number;
      description: string;
      buttonText: string;
      currency: string;
      createdAt: string;
    }>) || [];

    paymentLinks.push({
      id: paymentLink.id,
      url: paymentLink.url,
      amount,
      description,
      buttonText: buttonText || `${description}を購入する`,
      currency,
      createdAt: new Date().toISOString(),
    });

    await supabase.from('sites').update({
      settings_json: { ...settings, payment_links: paymentLinks },
    }).eq('id', siteId);

    return NextResponse.json({
      ok: true,
      paymentLinkId: paymentLink.id,
      url: paymentLink.url,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// GET /api/stripe/payment-link?siteId=xxx — list payment links for a site
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get('siteId');
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  const { data: site } = await supabase
    .from('sites')
    .select('settings_json')
    .eq('id', siteId)
    .eq('user_id', user.id)
    .single();

  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  const settings = (site.settings_json as Record<string, unknown>) || {};
  const paymentLinks = (settings.payment_links as unknown[]) || [];

  return NextResponse.json({ paymentLinks });
}

// DELETE /api/stripe/payment-link?siteId=xxx&linkId=xxx
export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get('siteId');
  const linkId = searchParams.get('linkId');
  if (!siteId || !linkId) return NextResponse.json({ error: 'siteId and linkId required' }, { status: 400 });

  const { data: site } = await supabase
    .from('sites')
    .select('settings_json')
    .eq('id', siteId)
    .eq('user_id', user.id)
    .single();

  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  const settings = (site.settings_json as Record<string, unknown>) || {};
  const paymentLinks = (settings.payment_links as Array<{ id: string }>) || [];

  await supabase.from('sites').update({
    settings_json: { ...settings, payment_links: paymentLinks.filter((l) => l.id !== linkId) },
  }).eq('id', siteId);

  // Deactivate on Stripe
  try {
    await stripe.paymentLinks.update(linkId, { active: false });
  } catch { /* ignore Stripe errors */ }

  return NextResponse.json({ ok: true });
}
