import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 公開サイトの予約カレンダーが空き枠を取得する。キャッシュ無効。
export const dynamic = 'force-dynamic';

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const HOLD_MS = 30 * 60 * 1000; // 仮押さえ(pending)の有効時間

interface Slot { id: string; datetime: string; duration: number; label: string; available: boolean }
interface BookingConfig { slots?: Slot[]; maxAdvanceDays?: number; prepayEnabled?: boolean; prepayAmount?: number }

export async function GET(req: Request) {
  const siteId = new URL(req.url).searchParams.get('siteId');
  if (!siteId) return NextResponse.json({ error: 'missing siteId' }, { status: 400 });

  const supabase = admin();
  const { data: site } = await supabase
    .from('sites')
    .select('data')
    .eq('id', siteId)
    .eq('published', true)
    .single();
  if (!site) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const cfg = ((site.data as Record<string, unknown>)?.bookingConfig as BookingConfig) || {};
  const now = Date.now();

  // 占有中のスロットID（確定 or 有効期限内の仮押さえ）
  const held = new Set<string>();
  const { data: resv } = await supabase
    .from('hp_reservations')
    .select('slot_id,status,created_at')
    .eq('site_id', siteId)
    .neq('status', 'canceled');
  for (const r of resv || []) {
    if (r.status === 'confirmed') held.add(r.slot_id);
    else if (r.status === 'pending' && now - new Date(r.created_at).getTime() < HOLD_MS) held.add(r.slot_id);
  }
  // 旧来の contacts ベース予約（extra_fields.slot_id）も占有扱い
  const { data: cts } = await supabase
    .from('contacts')
    .select('extra_fields')
    .eq('site_id', siteId)
    .eq('type', 'booking');
  for (const c of cts || []) {
    const sid = (c.extra_fields as Record<string, unknown> | null)?.slot_id as string | undefined;
    if (sid) held.add(sid);
  }

  const maxAdvanceMs = (cfg.maxAdvanceDays || 30) * 24 * 3600 * 1000;
  const slots = (cfg.slots || [])
    .filter(s => {
      if (!s.available || held.has(s.id)) return false;
      const t = new Date(s.datetime).getTime();
      return t > now && t < now + maxAdvanceMs;
    })
    .map(s => ({ id: s.id, datetime: s.datetime, duration: s.duration, label: s.label }));

  return NextResponse.json({
    slots,
    prepay: !!cfg.prepayEnabled && (cfg.prepayAmount || 0) > 0,
    prepayAmount: cfg.prepayAmount || 0,
  });
}
