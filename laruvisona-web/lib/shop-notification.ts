import { Resend } from 'resend';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/server';
import { escapeContactHtml, singleLine } from './contact-contract';
import { sendUserPush } from './push-notification';

type OrderItem = { name?: unknown; quantity?: unknown };

export async function deliverShopOrderNotification(
  orderId: string,
  db: SupabaseClient = createServiceClient(),
): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false;
  const orderResult = await db.from('hp_orders')
    .select('id,site_id,customer_email,amount,items,status,created_at,notified_at')
    .eq('id', orderId).maybeSingle();
  if (orderResult.error || !orderResult.data) return false;
  const order = orderResult.data;
  if (order.notified_at) return true;
  if (Date.now() - Date.parse(order.created_at) > 23 * 3600000) return false;

  const siteResult = await db.from('sites').select('name,user_id,settings_json').eq('id', order.site_id).single();
  if (siteResult.error || !siteResult.data) return false;
  const site = siteResult.data;
  const ownerResult = await db.auth.admin.getUserById(site.user_id);
  if (ownerResult.error) return false;
  const settings = (site.settings_json as Record<string, unknown>) || {};
  const to = typeof settings.notifyEmail === 'string' && settings.notifyEmail.trim()
    ? settings.notifyEmail.trim()
    : ownerResult.data.user?.email;
  if (!to) return false;

  const items = Array.isArray(order.items) ? order.items as OrderItem[] : [];
  const review = order.status === 'review'
    ? '<p style="padding:12px;background:#fff7ed;color:#9a3412">決済済みです。在庫との対応を確認してください。</p>' : '';
  const html = `<div style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px">
    <h2 style="color:#0f172a">新しいご注文</h2>${review}
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      ${items.map(item => `<tr><td style="padding:8px;border-bottom:1px solid #eee">${escapeContactHtml(typeof item.name === 'string' ? item.name : '商品')} × ${Number.isInteger(item.quantity) ? item.quantity : 1}</td></tr>`).join('')}
    </table>
    <p style="font-size:18px;font-weight:700;color:#0369a1">合計: ¥${Number(order.amount || 0).toLocaleString()}</p>
    <p style="color:#475569;font-size:14px">購入者メール: ${escapeContactHtml(order.customer_email || '—')}</p>
  </div>`;
  try {
    const response = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: 'LARU HP <noreply@laruvisona.jp>', to,
      subject: `【ご注文】${singleLine(site.name)} — 新しい注文が入りました`, html,
    }, { idempotencyKey: `hp-order-${order.id}-owner` });
    if (response.error) return false;
    const saved = await db.from('hp_orders').update({ notified_at: new Date().toISOString(), notification_last_error: null })
      .eq('id', order.id).is('notified_at', null).select('id');
    // 別の処理が先に同じ注文を完了していても成功として扱う。
    if (!saved.error && saved.data?.length === 1) {
      await sendUserPush(site.user_id, {
        title: `${site.name}に新しい注文`,
        body: `${items.length}種類・合計${Number(order.amount || 0).toLocaleString()}円の注文を確認してください。`,
        url: '/laruHP/orders', tag: `order-${order.id}`,
      }, db);
      return true;
    }
    const current = await db.from('hp_orders').select('notified_at').eq('id', order.id).maybeSingle();
    return !current.error && Boolean(current.data?.notified_at);
  } catch {
    return false;
  }
}
