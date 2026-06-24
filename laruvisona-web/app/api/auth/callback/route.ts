import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { Resend } from 'resend';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const requestHeaders = Object.fromEntries(request.headers.entries());
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/laruHP/dashboard';

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const forwardedHost = requestHeaders['x-forwarded-host'];
  const forwardedProto = requestHeaders['x-forwarded-proto'] || 'https';
  const origin = appUrl || (forwardedHost ? `${forwardedProto}://${forwardedHost}` : new URL(request.url).origin);

  if (code) {
    // Build the redirect response FIRST so we can attach cookies to it directly.
    // Using cookies().set() + NextResponse.redirect() loses the Set-Cookie headers.
    const redirectTo = `${origin}${next}`;
    const response = NextResponse.redirect(redirectTo);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Send welcome email once on first login
      const user = sessionData?.user;
      if (user && !user.user_metadata?.welcome_sent && process.env.RESEND_API_KEY) {
        try {
          const resend = new Resend(process.env.RESEND_API_KEY);
          await resend.emails.send({
            from: 'LARU HP <noreply@laruvisona.jp>',
            to: user.email!,
            subject: '【LARU HP】ご登録ありがとうございます',
            html: `
<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f9ff;font-family:'Helvetica Neue',Arial,sans-serif">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06)">
    <div style="background:linear-gradient(135deg,#0369a1,#0ea5e9);padding:40px 40px 32px">
      <div style="display:inline-flex;align-items:center;gap:10px;background:rgba(255,255,255,0.15);border-radius:10px;padding:8px 16px;margin-bottom:24px">
        <span style="font-size:16px;font-weight:900;color:white;letter-spacing:-0.5px">LARU<span style="font-weight:300">HP</span></span>
      </div>
      <h1 style="color:white;font-size:26px;font-weight:800;margin:0 0 8px;line-height:1.3">ご登録ありがとうございます！</h1>
      <p style="color:rgba(255,255,255,0.85);font-size:15px;margin:0">AIで最高のホームページを最短で。</p>
    </div>
    <div style="padding:36px 40px">
      <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 24px">LARU HP へようこそ！<br>次のステップで、あなたのサイトを5分で作り上げましょう。</p>
      <div style="background:#f8fafc;border-radius:12px;padding:24px;margin-bottom:28px">
        <div style="display:flex;flex-direction:column;gap:16px">
          ${[['1', '業種を選択', '飲食・美容・クリニックなど16業種に対応'],['2', 'AIが自動生成', '店名・住所・説明文を入力するだけ'],['3', 'エディタで調整', 'ドラッグ＆ドロップで自由にカスタマイズ'],['4', '公開！', '独自ドメインにも対応']]
            .map(([n, title, desc]) => `
          <div style="display:flex;align-items:flex-start;gap:14px">
            <div style="width:28px;height:28px;border-radius:50%;background:#0ea5e9;color:white;font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0">${n}</div>
            <div><div style="font-weight:700;color:#111827;font-size:14px;margin-bottom:2px">${title}</div><div style="color:#6b7280;font-size:13px">${desc}</div></div>
          </div>`).join('')}
        </div>
      </div>
      <a href="${origin}/laruHP/onboarding" style="display:block;text-align:center;background:linear-gradient(135deg,#0369a1,#0ea5e9);color:white;font-weight:800;font-size:15px;text-decoration:none;padding:16px 24px;border-radius:12px;margin-bottom:24px">
        サイト作成を始める →
      </a>
      <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0">ご不明な点は <a href="mailto:support@laruvisona.jp" style="color:#0ea5e9;text-decoration:none">support@laruvisona.jp</a> までお気軽にどうぞ</p>
    </div>
    <div style="background:#f8fafc;padding:20px 40px;text-align:center">
      <p style="color:#9ca3af;font-size:11px;margin:0">© ${new Date().getFullYear()} 株式会社LARUVisona · <a href="${origin}/laruHP" style="color:#9ca3af">laruvisona.jp</a></p>
    </div>
  </div>
</body>
</html>`,
          });
          await supabase.auth.updateUser({ data: { welcome_sent: true } });
        } catch {
          // Non-fatal
        }
      }
      return response;
    }
  }

  return NextResponse.redirect(`${origin}/laruHP/auth/login?error=auth`);
}
