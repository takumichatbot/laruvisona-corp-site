import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';
import { parseLegacyPaymentLinks, removeLegacyPaymentLink } from '@/lib/legacy-payment-links';

// Legacy endpoint. New sales must use the per-merchant Stripe Connect shop so
// money, orders, stock, notifications, and refunds stay in one ledger.
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({
    error: '新しい販売はショップから設定してください',
    code: 'legacy_payment_links_retired',
    next: '/laruHP/shop',
  }, { status: 410 });
}

// GET /api/stripe/payment-link?siteId=xxx — list payment links for a site
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get('siteId');
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  const { data: site, error } = await supabase
    .from('sites')
    .select('settings_json')
    .eq('id', siteId)
    .eq('user_id', user.id)
    .single();

  if (error || !site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  const rawLinks = parseLegacyPaymentLinks(site.settings_json);

  return NextResponse.json({ paymentLinks: rawLinks, retired: true });
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

  const { data: site, error } = await supabase
    .from('sites')
    .select('settings_json,updated_at')
    .eq('id', siteId)
    .eq('user_id', user.id)
    .single();

  if (error || !site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  const settings = (site.settings_json as Record<string, unknown>) || {};
  const paymentLinks = parseLegacyPaymentLinks(settings);
  if (!paymentLinks.some((link) => link.id === linkId)) {
    return NextResponse.json({ error: 'Payment link not found' }, { status: 404 });
  }

  // Keep the local reference until Stripe confirms that the public link is off.
  try {
    await stripe.paymentLinks.update(linkId, { active: false });
  } catch {
    return NextResponse.json({ error: 'Stripe側でリンクを停止できませんでした' }, { status: 502 });
  }

  const saved = await supabase.from('sites').update({
      settings_json: removeLegacyPaymentLink(settings, linkId),
    updated_at: new Date().toISOString(),
  }).eq('id', siteId).eq('user_id', user.id).eq('updated_at', site.updated_at).select('id');
  if (saved.error || saved.data?.length !== 1) {
    return NextResponse.json({ error: '停止済みリンクの記録を更新できませんでした' }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
