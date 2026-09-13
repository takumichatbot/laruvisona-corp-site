import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createServiceClient } from '@/lib/supabase/server';
import { escapeSequenceHtml, renderSequenceBody, type SequenceStep } from '@/lib/sequence-contract';

type Claim = {
  enrollment_id: string; claim_token: string; step_index: number; email: string;
  contact_name: string | null; site_name: string; sequence_steps: SequenceStep[];
};

export async function POST(req: Request) {
  const expected = process.env.RETENTION_SECRET;
  if (!expected || req.headers.get('authorization') !== `Bearer ${expected}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: 'メール送信が設定されていません' }, { status: 503 });

  const service = createServiceClient();
  const { data, error } = await service.rpc('laruhp_sequence_claim', { p_limit: 100 });
  if (error) return NextResponse.json({ error: '配信キューを取得できませんでした' }, { status: 500 });
  const claims = (data || []) as Claim[];
  const resend = new Resend(process.env.RESEND_API_KEY);
  let sent = 0, failed = 0, trackingFailed = 0;

  for (const claim of claims) {
    const step = claim.sequence_steps?.[claim.step_index];
    if (!step || !claim.email) {
      const { error: finishError } = await service.rpc('laruhp_sequence_finish', {
        p_enrollment: claim.enrollment_id, p_claim: claim.claim_token, p_success: false, p_provider_id: null, p_error: 'invalid_delivery_data',
      });
      failed++;
      if (finishError) trackingFailed++;
      continue;
    }
    const siteName = escapeSequenceHtml(claim.site_name);
    const fromName = claim.site_name.replace(/[\r\n<>]/g, ' ').trim().slice(0, 100) || 'LARU HP';
    let providerId: string | null = null;
    let failure = '';
    try {
      const result = await resend.emails.send({
        from: `${fromName} <noreply@laruvisona.jp>`, to: claim.email,
        subject: step.subject.replace(/[\r\n]/g, ' ').trim().slice(0, 200),
        html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:32px"><p style="font-size:12px;font-weight:700;color:#0369a1">${siteName}</p><div style="font-size:14px;color:#374151;line-height:1.8">${renderSequenceBody(step.body, claim.contact_name)}</div><hr style="margin:28px 0;border:0;border-top:1px solid #e5e7eb"><p style="font-size:11px;color:#9ca3af">${siteName}から送信しています</p></div>`,
      }, { idempotencyKey: `sequence-${claim.enrollment_id}-${claim.step_index}` });
      providerId = result.data?.id || null;
      failure = result.error?.message || (!providerId ? 'provider_id_missing' : '');
    } catch (error) { failure = error instanceof Error ? error.message : 'send_failed'; }

    const success = Boolean(providerId);
    const { data: finish, error: finishError } = await service.rpc('laruhp_sequence_finish', {
      p_enrollment: claim.enrollment_id, p_claim: claim.claim_token, p_success: success,
      p_provider_id: providerId, p_error: failure.slice(0, 500) || null,
    });
    if (finishError || !(finish as { ok?: boolean } | null)?.ok) trackingFailed++;
    if (success) sent++; else failed++;
  }
  return NextResponse.json({ ok: trackingFailed === 0, claimed: claims.length, sent, failed, trackingFailed }, { status: trackingFailed ? 500 : 200 });
}
