import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// POST /api/sms/reminders — cron endpoint to send booking SMS reminders
// Called every hour by cron job
// Authorization: Bearer <RETENTION_SECRET>

const RETENTION_SECRET = process.env.RETENTION_SECRET;

async function sendTwilioSms(to: string, body: string): Promise<boolean> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !from) return false;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
  });

  return res.ok;
}

export async function POST(req: Request) {
  const auth = req.headers.get('authorization');
  if (!RETENTION_SECRET || auth !== `Bearer ${RETENTION_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const service = await createServiceClient();

  // Find bookings that:
  // - have a phone number
  // - are upcoming (within next 25 hours)
  // - reminder not yet sent
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const in25h = new Date(now.getTime() + 25 * 60 * 60 * 1000).toISOString();
  const in1h = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  const in2h = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();

  // Fetch bookings from contacts (type=booking) with phone + datetime fields
  const { data: bookings24h } = await service
    .from('contacts')
    .select('id, site_id, name, phone, booking_datetime, extra_fields, sms_24h_sent')
    .eq('type', 'booking')
    .gte('booking_datetime', now.toISOString())
    .lte('booking_datetime', in25h)
    .not('phone', 'is', null)
    .eq('sms_24h_sent', false);

  const { data: bookings2h } = await service
    .from('contacts')
    .select('id, site_id, name, phone, booking_datetime, extra_fields, sms_2h_sent')
    .eq('type', 'booking')
    .gte('booking_datetime', now.toISOString())
    .lte('booking_datetime', in2h)
    .not('phone', 'is', null)
    .eq('sms_2h_sent', false);

  type Booking = {
    id: string;
    site_id: string;
    name: string;
    phone: string;
    booking_datetime: string;
    extra_fields?: Record<string, unknown>;
  };

  const sent24h: string[] = [];
  const sent2h: string[] = [];

  // Send 24h reminders
  for (const booking of (bookings24h || []) as Booking[]) {
    // Get site name
    const { data: site } = await service.from('sites').select('name').eq('id', booking.site_id).single();
    const siteName = site?.name || 'ご利用の店舗';

    const dt = new Date(booking.booking_datetime);
    const dateStr = dt.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    const message = `【${siteName}】${booking.name}様、明日${dateStr}のご予約のリマインダーです。ご変更の場合はお早めにご連絡ください。`;

    const normalized = booking.phone.replace(/[\s\-\(\)]/g, '').replace(/^0/, '+81');
    const ok = await sendTwilioSms(normalized, message);
    if (ok) sent24h.push(booking.id);
  }

  // Send 2h reminders
  for (const booking of (bookings2h || []) as Booking[]) {
    const { data: site } = await service.from('sites').select('name').eq('id', booking.site_id).single();
    const siteName = site?.name || 'ご利用の店舗';

    const dt = new Date(booking.booking_datetime);
    const timeStr = dt.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });

    const message = `【${siteName}】${booking.name}様、本日${timeStr}のご予約まであと2時間です。お気をつけてお越しください。`;

    const normalized = booking.phone.replace(/[\s\-\(\)]/g, '').replace(/^0/, '+81');
    const ok = await sendTwilioSms(normalized, message);
    if (ok) sent2h.push(booking.id);
  }

  // Mark as sent
  if (sent24h.length > 0) {
    await service.from('contacts').update({ sms_24h_sent: true }).in('id', sent24h);
  }
  if (sent2h.length > 0) {
    await service.from('contacts').update({ sms_2h_sent: true }).in('id', sent2h);
  }

  return NextResponse.json({
    ok: true,
    sent24h: sent24h.length,
    sent2h: sent2h.length,
  });
}
