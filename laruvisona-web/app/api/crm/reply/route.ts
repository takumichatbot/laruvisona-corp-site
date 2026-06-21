import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { Resend } from 'resend';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { contactId, message } = await req.json();
  if (!contactId || !message?.trim()) {
    return NextResponse.json({ error: 'contactId and message are required' }, { status: 400 });
  }

  const service = await createServiceClient();

  // Verify the contact belongs to this user's site
  const { data: contact } = await service
    .from('contacts')
    .select('id, name, email, site_id')
    .eq('id', contactId)
    .single();

  if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

  const { data: site } = await service
    .from('sites')
    .select('id, name')
    .eq('id', contact.site_id)
    .eq('user_id', user.id)
    .single();

  if (!site) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'Email not configured' }, { status: 503 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const escapedMessage = message.replace(/\n/g, '<br>');

  const { error } = await resend.emails.send({
    from: `${site.name} <noreply@laruvisona.jp>`,
    to: contact.email,
    replyTo: user.email!,
    subject: `${site.name} よりお問い合わせへのご返信`,
    html: `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Helvetica Neue',Arial,sans-serif">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06)">
    <div style="background:linear-gradient(135deg,#0369a1,#0ea5e9);padding:28px 36px">
      <div style="font-size:18px;font-weight:800;color:white">${site.name}</div>
    </div>
    <div style="padding:32px 36px">
      <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px">${contact.name} 様</p>
      <div style="color:#374151;font-size:15px;line-height:1.8;white-space:pre-wrap">${escapedMessage}</div>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0">
      <p style="color:#9ca3af;font-size:12px;margin:0">このメールへの返信は送信者に直接届きます。</p>
    </div>
  </div>
</body></html>`,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
