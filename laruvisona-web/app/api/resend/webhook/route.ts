import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createServiceClient } from '@/lib/supabase/server';

const EVENT_MAP: Record<string, string> = {
  'email.opened': 'opened',
  'email.clicked': 'clicked',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.delivery_delayed': 'delayed',
};

export async function POST(req: Request) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (!webhookSecret) return NextResponse.json({ error: 'Webhook is not configured' }, { status: 503 });
  if (Number(req.headers.get('content-length')) > 100_000) return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  const payload = await req.text();
  if (Buffer.byteLength(payload) > 100_000) return NextResponse.json({ error: 'Payload too large' }, { status: 413 });

  let event;
  try {
    event = new Resend(process.env.RESEND_API_KEY).webhooks.verify({
      payload,
      headers: {
        id: req.headers.get('svix-id') || '',
        timestamp: req.headers.get('svix-timestamp') || '',
        signature: req.headers.get('svix-signature') || '',
      },
      webhookSecret,
    });
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const eventType = EVENT_MAP[event.type];
  if (!eventType || !('email_id' in event.data) || !event.data.email_id) return NextResponse.json({ ok: true });
  const emailId = event.data.email_id;
  const service = createServiceClient();
  const { data: sent, error: sentError } = await service.from('newsletter_email_events')
    .select('campaign_id,recipient_email').eq('resend_email_id', emailId).eq('event_type', 'sent').single();
  if (sentError?.code === 'PGRST116') return NextResponse.json({ ok: true });
  if (sentError) return NextResponse.json({ error: 'Delivery could not be located' }, { status: 500 });
  if (!sent) return NextResponse.json({ ok: true });

  const { error: eventError } = await service.from('newsletter_email_events').upsert({
    campaign_id: sent.campaign_id,
    resend_email_id: emailId,
    recipient_email: sent.recipient_email,
    event_type: eventType,
  }, { onConflict: 'resend_email_id,event_type', ignoreDuplicates: true });
  if (eventError) return NextResponse.json({ error: 'Event could not be recorded' }, { status: 500 });

  if (eventType === 'opened' || eventType === 'clicked') {
    const column = eventType === 'opened' ? 'open_count' : 'click_count';
    const { count, error: countError } = await service.from('newsletter_email_events')
      .select('*', { count: 'exact', head: true }).eq('campaign_id', sent.campaign_id).eq('event_type', eventType);
    if (countError) return NextResponse.json({ error: 'Aggregate could not be counted' }, { status: 500 });
    const { data: updated, error: updateError } = await service.from('newsletter_campaigns')
      .update({ [column]: count ?? 0 }).eq('id', sent.campaign_id).select('id');
    if (updateError || updated?.length !== 1) return NextResponse.json({ error: 'Aggregate could not be updated' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
