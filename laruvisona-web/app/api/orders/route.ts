import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { canMoveOrder, isOrderStatus, parseOrderUpdate, validOrderId } from '@/lib/order-contract';

const databaseError = () => NextResponse.json(
  { error: '注文情報を確認できませんでした', code: 'database_error' },
  { status: 503 },
);

async function ownedSiteIds(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const result = await supabase.from('sites').select('id').eq('user_id', userId);
  return { ids: (result.data || []).map(site => site.id), error: result.error };
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const siteId = new URL(req.url).searchParams.get('siteId');
  if (siteId && !validOrderId(siteId)) return NextResponse.json({ error: 'サイトを確認してください' }, { status: 400 });
  const owned = await ownedSiteIds(supabase, user.id);
  if (owned.error) return databaseError();
  if (siteId && !owned.ids.includes(siteId)) return NextResponse.json({ error: 'サイトが見つかりません' }, { status: 404 });
  if (!owned.ids.length) return NextResponse.json({ orders: [] });

  let query = supabase
    .from('hp_orders')
    .select('id,site_id,customer_name,customer_email,customer_phone,amount,items,shipping,status,note,created_at')
    .in('site_id', owned.ids)
    .order('created_at', { ascending: false })
    .limit(200);
  if (siteId) query = query.eq('site_id', siteId);
  const { data, error } = await query;
  if (error) return databaseError();
  return NextResponse.json({ orders: data || [] });
}

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let update;
  try {
    update = parseOrderUpdate(await req.json());
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }

  const owned = await ownedSiteIds(supabase, user.id);
  if (owned.error) return databaseError();
  if (!owned.ids.length) return NextResponse.json({ error: '注文が見つかりません' }, { status: 404 });

  const { data: order, error: readError } = await supabase
    .from('hp_orders')
    .select('id,site_id,status')
    .eq('id', update.id)
    .in('site_id', owned.ids)
    .maybeSingle();
  if (readError) return databaseError();
  if (!order || !isOrderStatus(order.status)) return NextResponse.json({ error: '注文が見つかりません' }, { status: 404 });
  if (!canMoveOrder(order.status, update.status)) {
    return NextResponse.json({ error: 'この状態には変更できません' }, { status: 409 });
  }

  const { data: changed, error: updateError } = await supabase
    .from('hp_orders')
    .update({ status: update.status })
    .eq('id', update.id)
    .eq('site_id', order.site_id)
    .eq('status', order.status)
    .select('id,status');
  if (updateError) return databaseError();
  if (!changed || changed.length !== 1) {
    return NextResponse.json({ error: '別の画面で変更されました。読み直してください' }, { status: 409 });
  }
  return NextResponse.json({ order: changed[0] });
}
