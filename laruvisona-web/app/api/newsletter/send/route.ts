import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { Resend } from 'resend';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { siteId, subject, html } = await req.json() as { siteId: string; subject: string; html: string };
  if (!siteId || !subject || !html) {
    return NextResponse.json({ error: 'siteId, subject, html required' }, { status: 400 });
  }

  // Verify site ownership
  const { data: site } = await supabase.from('sites').select('name').eq('id', siteId).eq('user_id', user.id).single();
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  // Get active subscribers
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

  // Send in batches of 50 (Resend batch limit)
  const BATCH = 50;
  let sent = 0;
  for (let i = 0; i < subscribers.length; i += BATCH) {
    const batch = subscribers.slice(i, i + BATCH);
    await Promise.allSettled(
      batch.map(sub =>
        resend.emails.send({
          from: `${site.name} <noreply@laruvisona.jp>`,
          to: sub.email,
          subject,
          html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:32px">${html}<hr style="margin:32px 0;border:none;border-top:1px solid #e5e7eb"><p style="color:#9ca3af;font-size:12px">配信停止は<a href="${process.env.NEXT_PUBLIC_APP_URL}/api/newsletter/subscribe?siteId=${siteId}&email=${encodeURIComponent(sub.email)}" style="color:#6b7280">こちら</a></p></div>`,
        })
      )
    );
    sent += batch.length;
  }

  return NextResponse.json({ ok: true, sent });
}
