import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { Resend } from 'resend';
import { escapeContactHtml, singleLine } from '@/lib/contact-contract';

const replies = new Map<string, number[]>();
function allowReply(userId: string) {
  const now = Date.now();
  const recent = (replies.get(userId) || []).filter(at => now - at < 60 * 60 * 1000);
  if (recent.length >= 20) return false;
  replies.set(userId, [...recent, now]);
  return true;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.email) return NextResponse.json({ error: '送信元メールアドレスを確認できません' }, { status: 400 });
  if (!allowReply(user.id)) return NextResponse.json({ error: '送信回数が上限に達しました。時間をおいてお試しください' }, { status: 429 });

  const body = await req.json().catch(() => null);
  const contactId = typeof body?.contactId === 'string' ? body.contactId : '';
  const message = typeof body?.message === 'string' ? body.message : '';
  if (!contactId || !message.trim()) {
    return NextResponse.json({ error: 'contactId and message are required' }, { status: 400 });
  }
  if (typeof message !== 'string' || message.trim().length > 5000) {
    return NextResponse.json({ error: 'Message must be 5000 characters or less' }, { status: 400 });
  }

  const service = await createServiceClient();

  // Verify the contact belongs to this user's site
  const contactResult = await service
    .from('contacts')
    .select('id, name, email, site_id')
    .eq('id', contactId)
    .single();

  if (contactResult.error) return NextResponse.json({ error: '問い合わせを確認できません' }, { status: 503 });
  const contact = contactResult.data;
  if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

  const siteResult = await service
    .from('sites')
    .select('id, name')
    .eq('id', contact.site_id)
    .eq('user_id', user.id)
    .single();

  if (siteResult.error) return NextResponse.json({ error: 'サイトを確認できません' }, { status: 503 });
  const site = siteResult.data;
  if (!site) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'Email not configured' }, { status: 503 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const escapedMessage = escapeContactHtml(message.trim()).replace(/\r?\n/g, '<br>');
  const safeSiteName = escapeContactHtml(site.name);
  const safeContactName = escapeContactHtml(contact.name);

  const { error } = await resend.emails.send({
    from: `${singleLine(site.name)} <noreply@laruvisona.jp>`,
    to: contact.email,
    replyTo: user.email!,
    subject: `${singleLine(site.name)} よりお問い合わせへのご返信`,
    html: `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Helvetica Neue',Arial,sans-serif">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06)">
    <div style="background:linear-gradient(135deg,#0369a1,#0ea5e9);padding:28px 36px">
      <div style="font-size:18px;font-weight:800;color:white">${safeSiteName}</div>
    </div>
    <div style="padding:32px 36px">
      <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px">${safeContactName} 様</p>
      <div style="color:#374151;font-size:15px;line-height:1.8;white-space:pre-wrap">${escapedMessage}</div>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0">
      <p style="color:#9ca3af;font-size:12px;margin:0">このメールへの返信は送信者に直接届きます。</p>
    </div>
  </div>
</body></html>`,
  });

  if (error) {
    console.error('[CRM Reply] Resend error:', error);
    return NextResponse.json({ error: 'メールの送信に失敗しました' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
