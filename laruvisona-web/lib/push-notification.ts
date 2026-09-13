import webpush from 'web-push';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/server';

export type PushPayload = { title: string; body: string; url: string; tag: string };

export async function sendUserPush(userId: string, payload: PushPayload, db: SupabaseClient = createServiceClient()) {
  const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return { sent: 0, failed: 0, unavailable: true };
  webpush.setVapidDetails(`mailto:${process.env.VAPID_EMAIL || 'info@laruvisona.jp'}`, publicKey, privateKey);
  const rows = await db.from('hp_push_subscriptions').select('id,subscription').eq('user_id', userId).is('disabled_at', null);
  if (rows.error) return { sent: 0, failed: 0, unavailable: true };
  let sent = 0, failed = 0;
  for (const row of rows.data || []) {
    try {
      await webpush.sendNotification(row.subscription, JSON.stringify(payload), { TTL: 3600, urgency: 'high' });
      sent++;
    } catch (error) {
      failed++;
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await db.from('hp_push_subscriptions').update({ disabled_at: new Date().toISOString() }).eq('id', row.id).eq('user_id', userId);
      }
    }
  }
  return { sent, failed, unavailable: false };
}
