import { requireBearer } from '@/lib/scheduled-email';
import { createServiceClient } from '@/lib/supabase/server';
import { retryPendingEntitlements } from '@/lib/hp-entitlement-sync';

export const dynamic = 'force-dynamic';

/**
 * HP バンドルの権利同期（/api/hp/entitlement）の再送。server.js が 5 分ごとに呼ぶ（予約・注文通知の再送と同じ形）。
 * 控え（sites.settings_json.larubotEntitlement）が pending で next_at を過ぎたものだけ、控えた event_at のまま送り直す。
 */
export async function POST(req: Request) {
  if (!requireBearer(req, process.env.ADMIN_SECRET)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!process.env.LARU_HP_API_SECRET) return Response.json({ skipped: 'not_configured' });
  try {
    const counts = await retryPendingEntitlements(createServiceClient());
    return Response.json(counts, { status: counts.pending ? 503 : 200 });
  } catch {
    return Response.json({ error: 'Pending entitlements could not be read' }, { status: 503 });
  }
}
