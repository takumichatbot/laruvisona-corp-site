import { requireBearer } from '@/lib/scheduled-email';
import { createServiceClient } from '@/lib/supabase/server';
import { deliverShopOrderNotification } from '@/lib/shop-notification';

export const dynamic = 'force-dynamic';
type Claim = { order_id: string; claim_token: string };

export async function POST(req: Request) {
  const secret = process.env.ADMIN_SECRET;
  if (!requireBearer(req, secret)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!process.env.RESEND_API_KEY) return Response.json({ error: 'Mail delivery unavailable' }, { status: 503 });
  const db = createServiceClient();
  const claim = await db.rpc('laruhp_shop_claim_notifications', { p_limit: 20 });
  if (claim.error) return Response.json({ error: 'Notification storage unavailable' }, { status: 503 });
  let sent = 0, failed = 0;
  for (const row of (claim.data || []) as Claim[]) {
    const ok = await deliverShopOrderNotification(row.order_id, db);
    const finish = await db.rpc('laruhp_shop_finish_notification', {
      p_order_id: row.order_id, p_claim_token: row.claim_token,
      p_success: ok, p_error: ok ? null : 'delivery_failed',
    });
    if (finish.error || finish.data !== true) {
      return Response.json({ error: 'Could not save notification result', sent, failed }, { status: 503 });
    }
    if (ok) sent++; else failed++;
  }
  return Response.json({ claimed: (claim.data || []).length, sent, failed }, { status: failed ? 503 : 200 });
}
