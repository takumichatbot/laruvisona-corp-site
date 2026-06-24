import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { Resend } from 'resend';
import { createHmac } from 'crypto';

function makeToken(email: string): string {
  const ts = Date.now().toString();
  const sig = createHmac('sha256', process.env.ADMIN_SECRET ?? 'fallback')
    .update(`${email}:${ts}:reset`)
    .digest('hex');
  return Buffer.from(`${email}:${ts}:${sig}`).toString('base64url');
}

export async function POST(req: Request) {
  const { email } = await req.json().catch(() => ({}));
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });

  // ユーザーが存在するか確認
  const supabase = await createServiceClient();
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  if (error) return NextResponse.json({ error: 'server error' }, { status: 500 });
  const exists = users.some(u => u.email?.toLowerCase() === email.toLowerCase());
  if (!exists) return NextResponse.json({ error: 'このメールアドレスは登録されていません' }, { status: 400 });

  const requestHeaders = Object.fromEntries(req.headers.entries());
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const forwardedHost = requestHeaders['x-forwarded-host'];
  const forwardedProto = requestHeaders['x-forwarded-proto'] || 'https';
  const origin = appUrl || (forwardedHost ? `${forwardedProto}://${forwardedHost}` : 'https://laruvisona.com');

  const token = makeToken(email);
  // email を URL param にも乗せる（ページ側で atob デコードせずに済む）
  const link = `${origin}/laruHP/auth/update-password?token=${token}&email=${encodeURIComponent(email)}`;

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'メール送信が設定されていません（RESEND_API_KEY未設定）' }, { status: 500 });
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const sendResult = await resend.emails.send({
      from: 'LARU HP <noreply@laruvisona.jp>',
      to: email,
      subject: '【LARU HP】パスワードリセット',
      html: `
<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f9ff;font-family:'Helvetica Neue',Arial,sans-serif">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.06)">
    <div style="background:linear-gradient(135deg,#0369a1,#0ea5e9);padding:32px 40px">
      <span style="font-size:16px;font-weight:900;color:white;letter-spacing:-.5px">LARU<span style="font-weight:300">HP</span></span>
      <h1 style="color:white;font-size:22px;font-weight:800;margin:16px 0 0">パスワードリセット</h1>
    </div>
    <div style="padding:36px 40px">
      <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 28px">
        以下のボタンをクリックして新しいパスワードを設定してください。<br>
        リンクは <strong>1時間</strong> で期限切れになります。
      </p>
      <a href="${link}" style="display:block;text-align:center;background:linear-gradient(135deg,#0369a1,#0ea5e9);color:white;font-weight:800;font-size:15px;text-decoration:none;padding:16px 24px;border-radius:12px;margin-bottom:24px">
        パスワードを設定する →
      </a>
      <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0">
        ボタンが押せない場合はこのURLをブラウザに貼り付けてください：<br>
        <span style="word-break:break-all;color:#6b7280;font-size:11px">${link}</span>
      </p>
    </div>
  </div>
</body>
</html>`,
    });
    if (sendResult.error) {
      console.error('[password-reset] Resend error:', sendResult.error);
      return NextResponse.json({ error: 'メールの送信に失敗しました。しばらく経ってから再試行してください。' }, { status: 500 });
    }
  } catch (err) {
    console.error('[password-reset] Resend exception:', err);
    return NextResponse.json({ error: 'メールの送信に失敗しました。しばらく経ってから再試行してください。' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
