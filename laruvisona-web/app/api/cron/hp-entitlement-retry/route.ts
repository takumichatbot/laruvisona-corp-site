import { requireBearer } from '@/lib/scheduled-email';
import { createServiceClient } from '@/lib/supabase/server';
import { retryPendingEntitlements, retryPendingRecoveries } from '@/lib/hp-entitlement-sync';

export const dynamic = 'force-dynamic';

/**
 * HP バンドルの権利同期（/api/hp/entitlement）の再送。server.js が 5 分ごとに呼ぶ（予約・注文通知の再送と同じ形）。
 * 控え（sites.settings_json.larubotEntitlement）が pending で next_at を過ぎたものだけ、控えた event_at のまま送り直す。
 * あわせて、公開先の復帰待ち（larubotPublicationRecovery が pending）を、いまの状態を読み直してから再開する。
 */
export async function POST(req: Request) {
  if (!requireBearer(req, process.env.ADMIN_SECRET)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!process.env.LARU_HP_API_SECRET) return Response.json({ skipped: 'not_configured' });
  const db = createServiceClient();
  // 片方が読めなくても、もう片方は進める（権利の再送と、公開先の復帰待ちは別の控え）
  let counts: Awaited<ReturnType<typeof retryPendingEntitlements>> | null = null;
  let recovery: Awaited<ReturnType<typeof retryPendingRecoveries>> | null = null;
  try { counts = await retryPendingEntitlements(db); } catch { counts = null; }
  // 権利は同期済みで、公開先の復帰だけ待っているもの（記事一覧がまだ 200 でなかった）。権利 API は呼び直さない
  try { recovery = await retryPendingRecoveries(db); } catch { recovery = null; }
  const ok = counts !== null && recovery !== null;
  return Response.json({ ...(counts ?? { error: 'Pending entitlements could not be read' }), recovery: recovery ?? { error: 'Pending recoveries could not be read' } },
    { status: !ok || counts?.pending ? 503 : 200 });
}
