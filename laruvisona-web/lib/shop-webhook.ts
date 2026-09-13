import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cartFromMetadata, snapshotStripeItems } from './shop-order';
import { deliverShopOrderNotification } from './shop-notification';

export async function commitShopCheckout(
  session: Stripe.Checkout.Session,
  accountId: string | null,
  db: SupabaseClient,
  stripe: Stripe,
) {
  const metadata = (session.metadata || {}) as Record<string, string>;
  const siteId = metadata.laru_site_id;
  if (session.mode !== 'payment' || session.payment_status !== 'paid' || metadata.kind !== 'shop' || !siteId) {
    throw new Error('shop_mismatch');
  }

  const { data: site, error: siteError } = await db
    .from('sites').select('name,user_id,settings_json').eq('id', siteId).single();
  if (siteError || !site) throw new Error('shop_site');

  if (accountId) {
    const { data: merchant, error: merchantError } = await db.from('hp_payment_accounts')
      .select('account_id,livemode,charges_enabled,payouts_enabled')
      .eq('user_id', site.user_id).eq('account_id', accountId).maybeSingle();
    if (merchantError || !merchant || !merchant.charges_enabled || !merchant.payouts_enabled || merchant.livemode !== session.livemode) {
      throw new Error('shop_account');
    }
  }

  const cart = cartFromMetadata(metadata);
  const lines = await stripe.checkout.sessions.listLineItems(
    session.id,
    { limit: 100 },
    accountId ? { stripeAccount: accountId } : undefined,
  );
  if (lines.has_more) throw new Error('shop_lines');
  const orderItems = snapshotStripeItems(cart, lines.data);
  const itemTotal = orderItems.reduce((sum, item) => sum + item.unit * item.quantity, 0);
  if (itemTotal !== (session.amount_total || 0) || session.currency !== 'jpy') throw new Error('shop_amount');

  const customer = session.customer_details;
  const shippingRaw = (session as unknown as { shipping_details?: { name?: string; address?: Record<string, string> } }).shipping_details;
  const address = shippingRaw?.address || customer?.address || null;
  const shipping = address ? {
    name: shippingRaw?.name || customer?.name || '', phone: customer?.phone || '',
    postal_code: address.postal_code || '', state: address.state || '', city: address.city || '',
    line1: address.line1 || '', line2: address.line2 || '', country: address.country || '',
  } : null;
  const { data: committed, error: commitError } = await db.rpc('laruhp_shop_commit_order', {
    p_site_id: siteId,
    p_stripe_session_id: session.id,
    p_customer_name: customer?.name || null,
    p_customer_email: customer?.email || null,
    p_customer_phone: customer?.phone || null,
    p_amount: session.amount_total || 0,
    p_items: orderItems,
    p_shipping: shipping,
    p_cart: cart,
  });
  if (commitError || !committed || typeof committed !== 'object') throw new Error('shop_database');
  const result = committed as { created?: boolean; status?: string; id?: string };
  const intentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
  if (!result.id || !intentId) throw new Error('shop_intent');
  const linked = await db.from('hp_orders').update({
    stripe_account_id: accountId,
    stripe_payment_intent_id: intentId,
  }).eq('id', result.id).eq('site_id', siteId).select('id');
  if (linked.error || !linked.data || linked.data.length !== 1) throw new Error('shop_database');
  // 注文は既に確定している。通知失敗でStripeへ失敗を返さず、DBキューから再送する。
  // 重複Webhookでも未通知なら同じ冪等キーで再試行できる。
  try { await deliverShopOrderNotification(result.id, db); }
  catch { /* 注文確定を通知の障害で巻き戻さない。再送キューが引き継ぐ。 */ }
  return result;
}
