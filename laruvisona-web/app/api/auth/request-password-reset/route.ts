import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { Resend } from 'resend';

export async function POST(req: Request) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });

  const requestHeaders = Object.fromEntries(req.headers.entries());
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const forwardedHost = requestHeaders['x-forwarded-host'];
  const forwardedProto = requestHeaders['x-forwarded-proto'] || 'https';
  const origin = appUrl || (forwardedHost ? `${forwardedProto}://${forwardedHost}` : 'https://laruvisona.com');

  const supabase = await createServiceClient();

  // Admin API でリカバリーリンクを生成（PKCE 不要）
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: `${origin}/laruHP/auth/update-password` },
  });

  if (error || !data?.properties?.action_link) {
    return NextResponse.json({ error: 'このメールアドレスは登録されていません' }, { status: 400 });
  }

  // Resend でメール送信
  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
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
      <h1 style="color:white;font-size:22px;font-weight:800;margin:16px 0 0;line-height:1.3">パスワードリセット</h1>
    </div>
    <div style="padding:36px 40px">
      <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 28px">以下のボタンをクリックして、新しいパスワードを設定してください。<br>このリンクは1時間で期限切れになります。</p>
      <a href="${data.properties.action_link}" style="display:block;text-align:center;background:linear-gradient(135deg,#0369a1,#0ea5e9);color:white;font-weight:800;font-size:15px;text-decoration:none;padding:16px 24px;border-radius:12px;margin-bottom:24px">
        パスワードを設定する →
      </a>
      <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0">ボタンが押せない場合は以下のURLをブラウザに貼り付けてください：<br><span style="word-break:break-all;color:#6b7280">${data.properties.action_link}</span></p>
    </div>
  </div>
</body>
</html>`,
      });
    } catch {
      // メール送信失敗は非致命的
    }
  }

  return NextResponse.json({ ok: true });
}
