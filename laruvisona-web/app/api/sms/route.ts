import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST /api/sms
// Sends an SMS reminder via Twilio for a booking
// body: { to, message, bookingId?, siteId }

async function sendTwilioSms(to: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !from) {
    return { ok: false, error: 'Twilio not configured' };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    return { ok: false, error: err };
  }

  return { ok: true };
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { to, message, bookingId, siteId } = await req.json() as {
    to: string;
    message: string;
    bookingId?: string;
    siteId?: string;
  };

  if (!to || !message) return NextResponse.json({ error: 'to, message required' }, { status: 400 });

  // Normalize Japanese phone: 090-xxxx-xxxx → +8190xxxxxxxx
  const normalized = to
    .replace(/[\s\-\(\)]/g, '')
    .replace(/^0/, '+81');

  const result = await sendTwilioSms(normalized, message);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  // Log SMS send
  if (bookingId || siteId) {
    await supabase.from('sms_logs').insert({
      user_id: user.id,
      site_id: siteId ?? null,
      booking_id: bookingId ?? null,
      to_number: normalized,
      message,
      sent_at: new Date().toISOString(),
    });
  }

  return NextResponse.json({ ok: true });
}

// POST /api/sms/schedule-reminders — called by cron to send booking reminders
// This is a separate route at /api/sms/reminders
