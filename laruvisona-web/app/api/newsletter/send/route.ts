import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { Resend } from 'resend';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { siteId, subject, html } = await req.json() as { siteId: string; subject: string; html: string };
  if (!siteId || !subject || !html) {
    return NextResponse.json({ error: 'siteId, subject, html required' }, { status: 400 });
  }

  const { data: site } = await supabase.from('sites').select('name').eq('id', siteId).eq('user_id', user.id).single();
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  const { data: subscribers } = await supabase
    .from('newsletter_subscribers')
    .select('email, name')
    .eq('site_id', siteId)
    .is('unsubscribed_at', null);

  if (!subscribers || subscribers.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Resend not configured' }, { status: 500 });

  const resend = new Resend(apiKey);
  const service = await createServiceClient();

  // Create campaign record
  const { data: campaign } = await service
    .from('newsletter_campaigns')
    .insert({ site_id: siteId, user_id: user.id, subject, sent_count: subscribers.length })
    .select('id')
    .single()
    .then(r => r, () => ({ data: null }));

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://laruvisona.jp';
  const BATCH = 50;
  let sent = 0;
  const emailEvents: { campaign_id: string; resend_email_id: string; recipient_email: string; event_type: string }[] = [];

  for (let i = 0; i < subscribers.length; i += BATCH) {
    const batch = subscribers.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map(sub =>
        resend.emails.send({
          from: `${site.name} <noreply@laruvisona.jp>`,
          to: sub.email,
          subject,
          html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:32px">${html}<hr style="margin:32px 0;border:none;border-top:1px solid #e5e7eb"><p style="color:#9ca3af;font-size:12px">配信停止は<a href="${appUrl}/api/newsletter/subscribe?siteId=${siteId}&email=${encodeURIComponent(sub.email)}" style="color:#6b7280">こちら</a></p></div>`,
        }).then(r => ({ sub, emailId: r.data?.id }))
      )
    );
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.emailId && campaign?.id) {
        emailEvents.push({
          campaign_id: campaign.id,
          resend_email_id: r.value.emailId,
          recipient_email: r.value.sub.email,
          event_type: 'sent',
        });
      }
    }
    sent += batch.length;
  }

  // Store email IDs for tracking
  if (emailEvents.length > 0 && campaign?.id) {
    await service.from('newsletter_email_events').insert(emailEvents).then(() => {}, () => {});
  }

  return NextResponse.json({ ok: true, sent, campaignId: campaign?.id });
}
