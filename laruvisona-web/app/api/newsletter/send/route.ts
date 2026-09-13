import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { appUrlFallback } from '@/lib/site-origin';
import {
  escapeNewsletterHtml,
  newsletterSubscriberInSegment,
  newsletterVariantFor,
  parseNewsletterSend,
  readNewsletterBody,
  signNewsletterUnsubscribe,
} from '@/lib/newsletter-contract';

type Subscriber = { id: string; email: string; name: string | null; subscribed_at: string };

function unsubscribeSecret() {
  return process.env.NEWSLETTER_UNSUBSCRIBE_SECRET || process.env.ADMIN_SECRET || '';
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });
  let input;
  try { input = parseNewsletterSend(await readNewsletterBody(req)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : '入力を確認してください' }, { status: 400 }); }

  const { data: site, error: siteError } = await supabase.from('sites').select('id,name,settings_json').eq('id', input.siteId).eq('user_id', user.id).single();
  if (siteError || !site) return NextResponse.json({ error: 'サイトが見つかりません' }, { status: 404 });
  if ((site.settings_json as Record<string, unknown> | null)?.newsletter_paused === true) {
    return NextResponse.json({ error: 'このサイトのニュースレター配信は一時停止中です' }, { status: 409 });
  }
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: 'メール送信が設定されていません' }, { status: 503 });
  const secret = unsubscribeSecret();
  if (secret.length < 32) return NextResponse.json({ error: '配信停止機能が設定されていないため送信できません' }, { status: 503 });

  const service = createServiceClient();
  const { data: rows, error: subscribersError } = await service.from('newsletter_subscribers')
    .select('id,email,name,subscribed_at').eq('site_id', input.siteId).is('unsubscribed_at', null);
  if (subscribersError) return NextResponse.json({ error: '登録者を読み込めませんでした' }, { status: 500 });
  const now = Date.now();
  const subscribers = ((rows || []) as Subscriber[])
    .filter(row => newsletterSubscriberInSegment(row.subscribed_at, input.segment, now))
    .sort((a, b) => a.email.localeCompare(b.email));
  if (!subscribers.length) return NextResponse.json({ ok: true, sent: 0, failed: 0, groups: { A: 0, B: 0 } });

  const variants = input.subjectB ? ['A', 'B'] as const : ['A'] as const;
  const campaignIds = new Map<'A' | 'B', string>();
  for (const variant of variants) {
    const subject = variant === 'B' ? input.subjectB : input.subject;
    const { data: campaign, error } = await service.from('newsletter_campaigns').upsert({
      site_id: input.siteId, user_id: user.id, request_id: input.requestId, variant, subject,
    }, { onConflict: 'site_id,request_id,variant' }).select('id').single();
    if (error || !campaign?.id) return NextResponse.json({ error: '送信記録を準備できませんでした。メールは送っていません' }, { status: 500 });
    campaignIds.set(variant, campaign.id);
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const counts = { A: 0, B: 0 };
  const failures = { A: 0, B: 0 };
  const emailEvents: { campaign_id: string; resend_email_id: string; recipient_email: string; event_type: string }[] = [];
  const safeSiteName = escapeNewsletterHtml(site.name);
  const fromName = site.name.replace(/[\r\n<>]/g, ' ').trim().slice(0, 100) || 'LARU HP';
  const safeBody = escapeNewsletterHtml(input.body).replace(/\r?\n/g, '<br>');
  const appUrl = appUrlFallback();

  for (let index = 0; index < subscribers.length; index += 50) {
    const batch = subscribers.slice(index, index + 50);
    const results = await Promise.allSettled(batch.map(async subscriber => {
      const variant = newsletterVariantFor(subscriber.email, input.requestId, Boolean(input.subjectB));
      const campaignId = campaignIds.get(variant)!;
      const token = signNewsletterUnsubscribe({
        siteId: input.siteId,
        subscriberId: subscriber.id,
        expiresAt: now + 366 * 86_400_000,
      }, secret);
      const unsubscribeUrl = `${appUrl}/api/newsletter/subscribe?token=${encodeURIComponent(token)}`;
      const result = await resend.emails.send({
        from: `${fromName} <noreply@laruvisona.jp>`,
        to: subscriber.email,
        subject: variant === 'B' ? input.subjectB : input.subject,
        html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:32px"><div>${safeBody}</div><hr style="margin:32px 0;border:none;border-top:1px solid #e5e7eb"><p style="color:#9ca3af;font-size:12px">${safeSiteName}から送信しています。<a href="${unsubscribeUrl}" style="color:#6b7280">配信を停止する</a></p></div>`,
        headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      }, { idempotencyKey: `newsletter-${input.requestId}-${subscriber.id}` });
      return { variant, campaignId, subscriber, result };
    }));
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const fallbackVariant = newsletterVariantFor(batch[i].email, input.requestId, Boolean(input.subjectB));
      if (result.status === 'fulfilled' && result.value.result.data?.id) {
        const item = result.value;
        const emailId = item.result.data!.id;
        counts[item.variant]++;
        emailEvents.push({ campaign_id: item.campaignId, resend_email_id: emailId, recipient_email: item.subscriber.email, event_type: 'sent' });
      } else failures[fallbackVariant]++;
    }
  }

  let trackingWarning = false;
  for (const variant of variants) {
    const { error } = await service.from('newsletter_campaigns').update({ sent_count: counts[variant], failed_count: failures[variant] }).eq('id', campaignIds.get(variant)!);
    if (error) trackingWarning = true;
  }
  if (emailEvents.length) {
    const { error } = await service.from('newsletter_email_events').upsert(emailEvents, { onConflict: 'resend_email_id,event_type', ignoreDuplicates: true });
    if (error) trackingWarning = true;
  }

  const sent = counts.A + counts.B;
  const failed = failures.A + failures.B;
  return NextResponse.json({ ok: true, sent, failed, partial: failed > 0, groups: counts, trackingWarning, campaignIds: Object.fromEntries(campaignIds) });
}
