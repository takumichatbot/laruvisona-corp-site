import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { EmailOtpType } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { safeLaruHpRedirect } from '@/lib/auth-redirect';

/**
 * メールのリンクを踏んだ人を、ログインした状態にする。
 *
 * ── ここが塞がっていた ──
 *
 * 入口は `code` だけを見ていた。`code` を session に換えるには、
 * **登録したときのブラウザに残っている控え（code_verifier）が要る**（PKCE）。
 *
 * ところが人は、パソコンで登録して、**メールはスマホで開く。**
 * スマホにその控えは無い。だから
 *
 *   1. リンクを踏む → Supabase 側は「確認済み」にする（メールは本人のものなので）
 *   2. こちらへ戻ってくる → 控えが無いので交換に失敗する
 *   3. /laruHP/auth/login?error=auth へ飛ばす
 *   4. **ログイン画面はそのerrorを一切読んでいない。** 何の断りも無い素の画面が出る
 *
 * 登録した直後の人から見ると「メールのボタンを押したら、ログイン画面に戻された」。
 * 自分が登録できたのかも分からない。
 *
 * 本番にその跡が残っている。メールで登録した外部の2人が、
 * **確認済みなのに一度もログインしていない。** 2人ともそれきり来ていない。
 *
 * ── 直し方 ──
 *
 * token_hash を受け取って verifyOtp で確かめる形にする。こちらは控えが要らないので、
 * **どの端末・どのブラウザで開いても通る。** パスワード再設定も同じ経路に乗せる
 * （あちらは管理APIで作るリンクなので、そもそも控えが存在せず、
 *   実質ずっと通っていなかった）。
 *
 * `code` の道は残す。Google のログインは同じブラウザで始まって同じブラウザで
 * 終わるので、あちらは PKCE のままで正しい。
 */

/** verifyOtp に渡してよい種類だけを通す。 */
const OTP_TYPES = ['signup', 'recovery', 'invite', 'magiclink', 'email_change'] as const;
function otpType(value: string | null): EmailOtpType | null {
  return (OTP_TYPES as readonly string[]).includes(value || '') ? (value as EmailOtpType) : null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const requestHeaders = Object.fromEntries(request.headers.entries());
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = otpType(searchParams.get('type'));
  const next = safeLaruHpRedirect(searchParams.get('next'));

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const forwardedHost = requestHeaders['x-forwarded-host'];
  const forwardedProto = requestHeaders['x-forwarded-proto'] || 'https';
  const origin = appUrl || (forwardedHost ? `${forwardedProto}://${forwardedHost}` : new URL(request.url).origin);

  if (code || (tokenHash && type)) {
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

    const { data: sessionData, error } = tokenHash && type
      ? await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
      : await supabase.auth.exchangeCodeForSession(code!);
    if (error) {
      // recovery コードが切れていた場合 → ログイン画面でなく再リセット画面へ誘導
      if (next.startsWith('/laruHP/auth/update-password')) {
        return NextResponse.redirect(`${origin}/laruHP/auth/reset-password?expired=1`);
      }
      /*
        ここに落ちたとき、登録そのものは済んでいることが多い
        （Supabase 側はリンクを踏んだ時点で確認済みにする）。
        黙ってログイン画面へ戻すと、本人には**登録できたのかどうかも分からない。**
        何が起きたかを伝えて、次にすることを示す。
      */
      const reason = type === 'signup' ? 'confirmed_no_session' : 'auth';
      return NextResponse.redirect(`${origin}/laruHP/auth/login?error=${reason}`);
    }
    if (!error) {
      // Send welcome email once on first login
      const user = sessionData?.user;
      if (user && !user.user_metadata?.welcome_sent && process.env.RESEND_API_KEY) {
        try {
          const resend = new Resend(process.env.RESEND_API_KEY);
          const welcome = await resend.emails.send({
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
      <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 24px">LARU HP へようこそ。<br>完成像を確認しながら、あなたのサイトを形にしていきましょう。</p>
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
      <a href="${origin}/laruHP/studio" style="display:block;text-align:center;background:linear-gradient(135deg,#0369a1,#0ea5e9);color:white;font-weight:800;font-size:15px;text-decoration:none;padding:16px 24px;border-radius:12px;margin-bottom:24px">
        サイト作成を始める →
      </a>
      <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0">ご不明な点は <a href="mailto:info@laruvisona.jp" style="color:#0ea5e9;text-decoration:none">info@laruvisona.jp</a> までお気軽にどうぞ</p>
    </div>
    <div style="background:#f8fafc;padding:20px 40px;text-align:center">
      <p style="color:#9ca3af;font-size:11px;margin:0">© ${new Date().getFullYear()} 株式会社LaruVisona · <a href="${origin}/laruHP" style="color:#9ca3af">laruvisona.jp</a></p>
    </div>
  </div>
</body>
</html>`,
          });
          /*
            送れたか／印を付けられたかを、記録に残す。

            以前はどちらも黙っていた。届かなくても初回ログインは成功するので、
            **「送ったが失敗した」と「そもそも送っていない」が区別できない。**
            印の更新に失敗した場合は、次のログインで同じメールをもう一度送る。
          */
          if (welcome.error) {
            console.error('[auth] welcome mail not accepted:', welcome.error.message);
          } else {
            const marked = await supabase.auth.updateUser({ data: { welcome_sent: true } });
            if (marked.error) console.error('[auth] welcome_sent not recorded (may resend):', marked.error.message);
          }
        } catch (e) {
          console.error('[auth] welcome mail failed:', (e as Error)?.message);
        }
      }
      return response;
    }
  }

  return NextResponse.redirect(`${origin}/laruHP/auth/login?error=auth`);
}
