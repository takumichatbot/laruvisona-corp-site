import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { appUrlFallback } from '@/lib/site-origin';
import {
  loyaltyTokenHash,
  loyaltyTokenMatches,
  parseLoyaltyCommand,
  readLoyaltyBody,
  validLoyaltyCardId,
  validLoyaltyToken,
} from '@/lib/loyalty-contract';

function reply(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

function databaseError() {
  return reply({ error: '処理を完了できませんでした。時間をおいてもう一度お試しください' }, 500);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get('siteId');
  const cardId = searchParams.get('cardId');
  const token = searchParams.get('token');
  const service = createServiceClient();

  if (cardId) {
    if (!validLoyaltyCardId(cardId) || !validLoyaltyToken(token)) return reply({ error: 'カードが見つかりません' }, 404);
    const { data: card, error } = await service
      .from('loyalty_cards')
      .select('id, customer_name, stamps, max_stamps, reward, card_name, site_id, created_at, public_token_hash')
      .eq('id', cardId)
      .single();
    if (error || !card || !loyaltyTokenMatches(token, card.public_token_hash)) return reply({ error: 'カードが見つかりません' }, 404);
    const { data: site, error: siteError } = await service.from('sites').select('name, industry').eq('id', card.site_id).single();
    if (siteError || !site) return databaseError();
    const { public_token_hash: _secret, ...safeCard } = card;
    void _secret;
    return reply({ card: safeCard, site });
  }

  if (!siteId || !validLoyaltyCardId(siteId)) return reply({ error: 'サイトを確認してください' }, 400);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return reply({ error: 'ログインしてください' }, 401);
  const { data: site, error: siteError } = await supabase
    .from('sites').select('id, name, settings_json').eq('id', siteId).eq('user_id', user.id).single();
  if (siteError || !site) return reply({ error: 'サイトが見つかりません' }, 404);
  const { data: cards, error: cardsError } = await service
    .from('loyalty_cards')
    .select('id, customer_name, customer_phone, stamps, max_stamps, reward, created_at, last_stamped_at')
    .eq('site_id', siteId).order('created_at', { ascending: false });
  if (cardsError) return databaseError();
  const config = (site.settings_json as Record<string, unknown> | null)?.loyalty_config ?? null;
  return reply({ cards, config });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return reply({ error: 'ログインしてください' }, 401);

  let command;
  try {
    command = parseLoyaltyCommand(await readLoyaltyBody(req));
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : '入力を確認してください' }, 400);
  }

  const { data: site, error: siteError } = await supabase
    .from('sites').select('id, settings_json').eq('id', command.siteId).eq('user_id', user.id).single();
  if (siteError || !site) return reply({ error: 'サイトが見つかりません' }, 404);
  const service = createServiceClient();

  if (command.action === 'configure') {
    const { data, error } = await service.rpc('laruhp_loyalty_configure', {
      p_site: command.siteId,
      p_owner: user.id,
      p_config: { maxStamps: command.maxStamps, reward: command.reward, cardName: command.cardName },
    });
    if (error || !(data as { ok?: boolean } | null)?.ok) return databaseError();
    return reply({ ok: true });
  }

  const rawConfig = (site.settings_json as Record<string, unknown> | null)?.loyalty_config;
  const config = rawConfig && typeof rawConfig === 'object' && !Array.isArray(rawConfig)
    ? rawConfig as Record<string, unknown> : {};
  const maxStamps = Number.isInteger(config.maxStamps) && Number(config.maxStamps) >= 1 && Number(config.maxStamps) <= 50
    ? Number(config.maxStamps) : 10;
  const reward = typeof config.reward === 'string' && config.reward.trim() && config.reward.length <= 200
    ? config.reward.trim() : '特典プレゼント';
  const cardName = typeof config.cardName === 'string' && config.cardName.trim() && config.cardName.length <= 80
    ? config.cardName.trim() : 'スタンプカード';
  const token = randomBytes(32).toString('base64url');
  const { data: card, error } = await service.from('loyalty_cards').insert({
    site_id: command.siteId,
    customer_name: command.customerName,
    customer_phone: command.customerPhone || null,
    stamps: 0,
    max_stamps: maxStamps,
    reward,
    card_name: cardName,
    public_token_hash: loyaltyTokenHash(token),
  }).select('id').single();
  if (error || !card?.id) return databaseError();
  const cardUrl = `${appUrlFallback()}/laruHP/loyalty/card/${card.id}?token=${encodeURIComponent(token)}`;
  return reply({ ok: true, cardId: card.id, cardUrl });
}

export async function PATCH(req: Request) {
  const cardId = new URL(req.url).searchParams.get('cardId');
  if (!validLoyaltyCardId(cardId)) return reply({ error: 'カードを確認してください' }, 400);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return reply({ error: 'ログインしてください' }, 401);
  const { data, error } = await createServiceClient().rpc('laruhp_loyalty_add_stamp', {
    p_card: cardId,
    p_owner: user.id,
  });
  const result = data as { ok?: boolean; stamps?: number; maxStamps?: number; completed?: boolean; reward?: string | null } | null;
  if (error?.message?.includes('card_not_found')) return reply({ error: 'カードが見つかりません' }, 404);
  if (error || !result?.ok || !Number.isInteger(result.stamps) || !Number.isInteger(result.maxStamps)) return databaseError();
  return reply({
    ok: true,
    stamps: result.stamps,
    maxStamps: result.maxStamps,
    completed: Boolean(result.completed),
    reward: result.completed ? result.reward : null,
  });
}
