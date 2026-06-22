import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

// GET  /api/loyalty?siteId=xxx — list loyalty cards for a site (owner view)
// GET  /api/loyalty?cardId=xxx — get a customer's card (public, no auth)
// POST /api/loyalty — create a new loyalty card program config
// PATCH /api/loyalty?cardId=xxx — add stamp to customer card (requires site owner auth or site secret)

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get('siteId');
  const cardId = searchParams.get('cardId');

  const service = await createServiceClient();

  if (cardId) {
    // Public: return card info for display
    const { data: card } = await service
      .from('loyalty_cards')
      .select('id, customer_name, stamps, max_stamps, reward, site_id, created_at')
      .eq('id', cardId)
      .single();

    if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 });

    const { data: site } = await service.from('sites').select('name, industry').eq('id', card.site_id).single();

    return NextResponse.json({ card, site });
  }

  if (siteId) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Verify ownership
    const { data: site } = await supabase.from('sites').select('id, name, settings_json').eq('id', siteId).eq('user_id', user.id).single();
    if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

    // Get all loyalty cards for this site
    const { data: cards } = await service
      .from('loyalty_cards')
      .select('id, customer_name, customer_phone, stamps, max_stamps, reward, created_at, last_stamped_at')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false });

    const config = (site.settings_json as Record<string, unknown>)?.loyalty_config as {
      maxStamps: number;
      reward: string;
      cardName: string;
    } | null;

    return NextResponse.json({ cards: cards || [], config });
  }

  return NextResponse.json({ error: 'siteId or cardId required' }, { status: 400 });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as {
    action: 'configure' | 'issue';
    siteId: string;
    // configure
    maxStamps?: number;
    reward?: string;
    cardName?: string;
    // issue new card to customer
    customerName?: string;
    customerPhone?: string;
  };

  const { action, siteId } = body;
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  const { data: site } = await supabase.from('sites').select('id, settings_json').eq('id', siteId).eq('user_id', user.id).single();
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  const service = await createServiceClient();

  if (action === 'configure') {
    const settings = (site.settings_json as Record<string, unknown>) || {};
    await supabase.from('sites').update({
      settings_json: {
        ...settings,
        loyalty_config: {
          maxStamps: body.maxStamps || 10,
          reward: body.reward || '特典プレゼント',
          cardName: body.cardName || 'スタンプカード',
        },
      },
    }).eq('id', siteId);

    return NextResponse.json({ ok: true });
  }

  if (action === 'issue') {
    const settings = (site.settings_json as Record<string, unknown>) || {};
    const config = (settings.loyalty_config as { maxStamps?: number; reward?: string } | null) || {};

    const { data: card, error } = await service.from('loyalty_cards').insert({
      site_id: siteId,
      customer_name: body.customerName || '未設定',
      customer_phone: body.customerPhone || null,
      stamps: 0,
      max_stamps: config.maxStamps || 10,
      reward: config.reward || '特典プレゼント',
      created_at: new Date().toISOString(),
    }).select('id').single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const cardUrl = `${process.env.NEXT_PUBLIC_APP_URL}/laruHP/loyalty/card/${card!.id}`;
    return NextResponse.json({ ok: true, cardId: card!.id, cardUrl });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

export async function PATCH(req: Request) {
  const { searchParams } = new URL(req.url);
  const cardId = searchParams.get('cardId');
  if (!cardId) return NextResponse.json({ error: 'cardId required' }, { status: 400 });

  // Auth: must be site owner
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = await createServiceClient();

  const { data: card } = await service
    .from('loyalty_cards')
    .select('id, site_id, stamps, max_stamps, reward, customer_name')
    .eq('id', cardId)
    .single();

  if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 });

  // Verify site ownership
  const { data: site } = await supabase.from('sites').select('id').eq('id', card.site_id).eq('user_id', user.id).single();
  if (!site) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const newStamps = Math.min(card.stamps + 1, card.max_stamps);
  const completed = newStamps >= card.max_stamps;

  await service.from('loyalty_cards').update({
    stamps: newStamps,
    last_stamped_at: new Date().toISOString(),
    completed_at: completed ? new Date().toISOString() : null,
  }).eq('id', cardId);

  return NextResponse.json({
    ok: true,
    stamps: newStamps,
    maxStamps: card.max_stamps,
    completed,
    reward: completed ? card.reward : null,
  });
}
