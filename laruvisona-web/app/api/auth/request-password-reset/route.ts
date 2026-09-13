import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { Resend } from 'resend';
import { clientIp } from '@/lib/rate-limit';
import { claimPublicRate } from '@/lib/public-rate-limit';
import { readContactBody } from '@/lib/contact-contract';

export async function POST(req: Request) {
  const supabase = await createServiceClient();
  const rate = await claimPublicRate(supabase, 'account-reset', clientIp(req), 5);
  if (rate !== 'allowed') return NextResponse.json({ ok: true });
  let body: Record<string, unknown>;
  try { body = await readContactBody(req, 4096); }
  catch { return NextResponse.json({ ok: true }); }
  const rawEmail = body.email;
  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return NextResponse.json({ ok: true });
  }

  const origin = (process.env.NEXT_PUBLIC_APP_URL || 'https://laruvisona.jp').replace(/\/$/, '');
  const redirectTo = `${origin}/api/auth/callback?next=${encodeURIComponent('/laruHP/auth/update-password')}`;
  const generated = await supabase.auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo } });
  const link = generated.data?.properties?.action_link;
  // 登録有無と外部メール障害を応答から判別できないよう、公開応答は常に同じにする。
  if (generated.error || !link) {
    console.warn('[password-reset] recovery link unavailable:', generated.error?.code || 'not_found');
    return NextResponse.json({ ok: true });
  }

  if (!process.env.RESEND_API_KEY) {
    console.warn('[password-reset] RESEND_API_KEY is not configured');
    return NextResponse.json({ ok: true });
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
    if (sendResult.error) console.error('[password-reset] Resend rejected:', sendResult.error.name);
  } catch (err) {
    console.error('[password-reset] Resend exception:', (err as Error)?.message);
  }

  return NextResponse.json({ ok: true });
}
