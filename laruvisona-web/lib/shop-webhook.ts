import { Resend } from 'resend';
import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cartFromMetadata, snapshotStripeItems } from './shop-order';
import { escapeContactHtml, singleLine } from './contact-contract';

async function notify(to: string, subject: string, html: string) {
  if (!process.env.RESEND_API_KEY) return;
  try {
    await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: 'LARU HP <noreply@laruvisona.jp>', to, subject, html,
    });
  } catch { /* 注文は保存済み。通知失敗でWebhookを再処理しない */ }
}

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
  if (!result.created) return result;

  const settings = (site.settings_json as Record<string, unknown>) || {};
  const { data: { user: owner } } = await db.auth.admin.getUserById(site.user_id);
  const to = typeof settings.notifyEmail === 'string' && settings.notifyEmail ? settings.notifyEmail : owner?.email;
  if (to) {
    const review = result.status === 'review'
      ? '<p style="padding:12px;background:#fff7ed;color:#9a3412">在庫との対応を確認してください。</p>' : '';
    await notify(
      to,
      `【ご注文】${singleLine(site.name)} — 新しい注文が入りました`,
      `<div style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px">
        <h2 style="color:#0f172a">新しいご注文</h2>${review}
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          ${orderItems.map(item => `<tr><td style="padding:8px;border-bottom:1px solid #eee">${escapeContactHtml(item.name)} × ${item.quantity}</td></tr>`).join('')}
        </table>
        <p style="font-size:18px;font-weight:700;color:#0369a1">合計: ¥${(session.amount_total || 0).toLocaleString()}</p>
        <p style="color:#475569;font-size:14px">購入者メール: ${escapeContactHtml(customer?.email || '—')}</p>
      </div>`,
    );
  }
  return result;
}
