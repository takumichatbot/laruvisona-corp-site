import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// Receives email events from Resend (opened, clicked, bounced, complained).
// Configure in Resend Dashboard → Webhooks → Add endpoint:
//   URL: https://laruvisona.jp/api/resend/webhook
//   Events: email.opened, email.clicked, email.bounced, email.complained
// Set RESEND_WEBHOOK_SECRET in env and paste the signing secret from Resend.

const EVENT_MAP: Record<string, string> = {
  'email.opened': 'opened',
  'email.clicked': 'clicked',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.delivery_delayed': 'delayed',
};

export async function POST(req: Request) {
  // Verify Resend webhook signature (optional but recommended)
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (webhookSecret) {
    const signature = req.headers.get('svix-signature');
    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }
    // Simple presence check — for full HMAC verification use the svix package
  }

  const body = await req.json() as { type: string; data: { email_id: string; to?: string[]; created_at?: string } };
  const eventType = EVENT_MAP[body.type];
  if (!eventType) return NextResponse.json({ ok: true });

  const emailId = body.data?.email_id;
  if (!emailId) return NextResponse.json({ ok: true });

  const service = await createServiceClient();

  // Find the campaign this email belongs to
  const { data: sent } = await service
    .from('newsletter_email_events')
    .select('campaign_id, recipient_email')
    .eq('resend_email_id', emailId)
    .eq('event_type', 'sent')
    .single();

  if (!sent) return NextResponse.json({ ok: true });

  // Insert the event
  await service.from('newsletter_email_events').insert({
    campaign_id: sent.campaign_id,
    resend_email_id: emailId,
    recipient_email: sent.recipient_email,
    event_type: eventType,
  }).then(() => {}, () => {});

  // Update aggregate counts on the campaign
  if (eventType === 'opened' || eventType === 'clicked') {
    const column = eventType === 'opened' ? 'open_count' : 'click_count';

    // Count unique events for this campaign
    const { count } = await service
      .from('newsletter_email_events')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', sent.campaign_id)
      .eq('event_type', eventType);

    await service
      .from('newsletter_campaigns')
      .update({ [column]: count ?? 0 })
      .eq('id', sent.campaign_id)
      .then(() => {}, () => {});
  }

  return NextResponse.json({ ok: true });
}
