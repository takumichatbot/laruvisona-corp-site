import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(req: Request) {
  const { siteId, name, email, phone, message, type } = await req.json();

  if (!siteId || !name || !email) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const supabase = getAdminClient();

  // Get site + owner email
  const { data: site } = await supabase
    .from('sites')
    .select('name, user_id, settings_json')
    .eq('id', siteId)
    .eq('published', true)
    .single();

  if (!site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  // Get owner email from auth.users
  const { data: userData } = await supabase.auth.admin.getUserById(site.user_id);
  const settings = site.settings_json as Record<string, unknown> | null;
  const toEmail = (settings?.notifyEmail as string) || userData?.user?.email;

  if (!toEmail) {
    return NextResponse.json({ error: 'No notification email configured' }, { status: 400 });
  }

  // Send email via Resend
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Dev fallback: just log and return ok
    console.log('[Contact form]', { siteId, name, email, phone, message });
    return NextResponse.json({ ok: true });
  }

  const resend = new Resend(apiKey);
  const subject = type === 'booking'
    ? `【予約リクエスト】${site.name} — ${name} 様より`
    : `【お問い合わせ】${site.name} — ${name} 様より`;

  const body = type === 'booking'
    ? `
<h2>新しい予約リクエストが届きました</h2>
<table style="border-collapse:collapse;width:100%;max-width:500px">
  <tr><td style="padding:8px 12px;background:#f9fafb;font-weight:700;border-bottom:1px solid #e5e7eb;width:120px">お名前</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${name}</td></tr>
  <tr><td style="padding:8px 12px;background:#f9fafb;font-weight:700;border-bottom:1px solid #e5e7eb">メール</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${email}</td></tr>
  <tr><td style="padding:8px 12px;background:#f9fafb;font-weight:700;border-bottom:1px solid #e5e7eb">電話番号</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${phone || '—'}</td></tr>
  <tr><td style="padding:8px 12px;background:#f9fafb;font-weight:700;border-bottom:1px solid #e5e7eb">詳細</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;white-space:pre-line">${message || '—'}</td></tr>
</table>
<p style="margin-top:24px;color:#6b7280;font-size:14px">このメールは LARU HP (${site.name}) の予約フォームから自動送信されました。</p>
`
    : `
<h2>新しいお問い合わせが届きました</h2>
<table style="border-collapse:collapse;width:100%;max-width:500px">
  <tr><td style="padding:8px 12px;background:#f9fafb;font-weight:700;border-bottom:1px solid #e5e7eb;width:120px">お名前</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${name}</td></tr>
  <tr><td style="padding:8px 12px;background:#f9fafb;font-weight:700;border-bottom:1px solid #e5e7eb">メール</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${email}</td></tr>
  <tr><td style="padding:8px 12px;background:#f9fafb;font-weight:700;border-bottom:1px solid #e5e7eb">電話番号</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${phone || '—'}</td></tr>
  <tr><td style="padding:8px 12px;background:#f9fafb;font-weight:700;">お問い合わせ内容</td><td style="padding:8px 12px;white-space:pre-line">${message}</td></tr>
</table>
<p style="margin-top:24px;color:#6b7280;font-size:14px">このメールは LARU HP (${site.name}) のお問い合わせフォームから自動送信されました。</p>
`;

  await resend.emails.send({
    from: 'LARU HP <noreply@laruvisona.jp>',
    to: toEmail,
    replyTo: email,
    subject,
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:32px">${body}</div>`,
  });

  return NextResponse.json({ ok: true });
}
