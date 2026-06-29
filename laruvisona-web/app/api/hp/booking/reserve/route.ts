import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { stripe } from '@/lib/stripe';
import { finalizeBooking } from '@/lib/booking-finalize';

export const dynamic = 'force-dynamic';

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const HOLD_MS = 30 * 60 * 1000;

interface Slot { id: string; datetime: string; duration: number; label: string; available: boolean }
interface BookingConfig { slots?: Slot[]; prepayEnabled?: boolean; prepayAmount?: number }

export async function POST(req: Request) {
  const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || '';
  const { siteId, slotId, name, email, phone, service, _hp } = await req.json().catch(() => ({}));

  if (_hp) return NextResponse.json({ ok: true }); // ハニーポット
  if (!siteId || !slotId || !name || !email) {
    return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 });
  }

  const supabase = admin();
  const { data: site } = await supabase
    .from('sites')
    .select('name, data')
    .eq('id', siteId)
    .eq('published', true)
    .single();
  if (!site) return NextResponse.json({ error: 'サイトが見つかりません' }, { status: 404 });

  const cfg = ((site.data as Record<string, unknown>)?.bookingConfig as BookingConfig) || {};
  const slot = (cfg.slots || []).find(s => s.id === slotId);
  if (!slot || !slot.available) {
    return NextResponse.json({ error: 'この枠は予約できません' }, { status: 400 });
  }
  if (new Date(slot.datetime).getTime() <= Date.now()) {
    return NextResponse.json({ error: 'この枠は受付を終了しました' }, { status: 400 });
  }

  // 期限切れの仮押さえを解放してから予約
  await supabase
    .from('hp_reservations')
    .delete()
    .eq('site_id', siteId)
    .eq('slot_id', slotId)
    .eq('status', 'pending')
    .lt('created_at', new Date(Date.now() - HOLD_MS).toISOString());

  const prepay = !!cfg.prepayEnabled && (cfg.prepayAmount || 0) > 0;
  const amount = prepay ? Math.round(cfg.prepayAmount || 0) : 0;

  // 予約を作成（部分ユニークインデックスで二重予約を防止）
  const { data: reservation, error: insErr } = await supabase
    .from('hp_reservations')
    .insert({
      site_id: siteId,
      slot_id: slotId,
      slot_datetime: slot.datetime,
      service: service || slot.label || null,
      name,
      email,
      phone: phone || null,
      amount,
      status: prepay ? 'pending' : 'confirmed',
    })
    .select('id')
    .single();

  if (insErr || !reservation) {
    // 23505 = unique_violation（誰かが先に予約した）
    if ((insErr as { code?: string })?.code === '23505') {
      return NextResponse.json({ error: 'この枠はちょうど埋まりました。別の枠をお選びください。' }, { status: 409 });
    }
    console.error('[booking/reserve] insert error:', insErr);
    return NextResponse.json({ error: '予約に失敗しました' }, { status: 500 });
  }

  // 事前決済あり: Stripe Checkout へ
  if (prepay) {
    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'jpy',
            product_data: { name: `予約金 — ${service || slot.label || site.name}` },
            unit_amount: amount,
          },
          quantity: 1,
        }],
        customer_email: email,
        metadata: { kind: 'booking', reservation_id: reservation.id, site_id: siteId },
        expires_at: Math.floor((Date.now() + HOLD_MS) / 1000),
        success_url: `${origin}/?booking=success`,
        cancel_url: `${origin}/?booking=canceled`,
        locale: 'ja',
      });
      await supabase.from('hp_reservations').update({ stripe_session_id: session.id }).eq('id', reservation.id);
      return NextResponse.json({ url: session.url });
    } catch (err: unknown) {
      // 決済セッション作成に失敗したら仮押さえを解放
      await supabase.from('hp_reservations').update({ status: 'canceled' }).eq('id', reservation.id);
      console.error('[booking/reserve] stripe error:', (err as { message?: string })?.message);
      return NextResponse.json({ error: '決済の準備に失敗しました' }, { status: 500 });
    }
  }

  // 事前決済なし: 即確定して通知
  await finalizeBooking({
    baseUrl: origin,
    siteId,
    name,
    email,
    phone,
    service: service || slot.label,
    slotId,
    slotDatetime: slot.datetime,
    prepaid: false,
  });
  return NextResponse.json({ ok: true });
}
