import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { Resend } from 'resend';
import crypto from 'crypto';

type Params = { params: Promise<{ id: string }> };

// GET — list members of a site
export async function GET(_req: Request, { params }: Params) {
  const { id: siteId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: site } = await supabase.from('sites').select('id').eq('id', siteId).eq('user_id', user.id).single();
  if (!site) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const service = await createServiceClient();
  const { data: members } = await service
    .from('site_members')
    .select('id, invited_email, role, status, created_at')
    .eq('site_id', siteId)
    .order('created_at', { ascending: true });

  return NextResponse.json({ members: members || [] });
}

// POST — invite a member by email
export async function POST(req: Request, { params }: Params) {
  const { id: siteId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: site } = await supabase
    .from('sites')
    .select('id, name')
    .eq('id', siteId)
    .eq('user_id', user.id)
    .single();
  if (!site) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { email, role = 'editor' } = await req.json() as { email: string; role?: string };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return NextResponse.json({ error: 'メールアドレスが無効です' }, { status: 400 });

  const token = crypto.randomBytes(24).toString('hex');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://laruvisona.jp';
  const inviteUrl = `${appUrl}/laruHP/invite/${token}`;

  const service = await createServiceClient();

  // Upsert — re-invite if already pending
  const { error: dbErr } = await service.from('site_members').upsert({
    site_id: siteId,
    invited_email: email.toLowerCase(),
    role,
    status: 'pending',
    invite_token: token,
  }, { onConflict: 'site_id,invited_email', ignoreDuplicates: false });

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

  // Send invite email
  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: `LARU HP <noreply@laruvisona.jp>`,
      to: email,
      subject: `「${site.name}」の編集メンバーに招待されました`,
      html: `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Helvetica Neue',Arial,sans-serif">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06)">
    <div style="background:linear-gradient(135deg,#0369a1,#0ea5e9);padding:28px 36px">
      <div style="font-size:18px;font-weight:800;color:white">LARU HP</div>
    </div>
    <div style="padding:32px 36px">
      <h2 style="color:#111827;font-size:18px;margin:0 0 12px">サイト編集への招待</h2>
      <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0 0 24px">
        <strong style="color:#111827">「${site.name}」</strong> の編集メンバーに招待されました。<br>
        以下のボタンから参加してください。
      </p>
      <a href="${inviteUrl}" style="display:inline-block;background:#0369a1;color:#fff;font-weight:700;padding:14px 28px;border-radius:10px;text-decoration:none;font-size:15px">
        招待を承認する
      </a>
      <p style="color:#9ca3af;font-size:11px;margin:24px 0 0">このリンクは72時間有効です。心当たりのない場合は無視してください。</p>
    </div>
  </div>
</body></html>`,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}

// DELETE — remove a member
export async function DELETE(req: Request, { params }: Params) {
  const { id: siteId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: site } = await supabase.from('sites').select('id').eq('id', siteId).eq('user_id', user.id).single();
  if (!site) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { email } = await req.json() as { email: string };
  const service = await createServiceClient();
  await service.from('site_members').delete().eq('site_id', siteId).eq('invited_email', email.toLowerCase());

  return NextResponse.json({ ok: true });
}
