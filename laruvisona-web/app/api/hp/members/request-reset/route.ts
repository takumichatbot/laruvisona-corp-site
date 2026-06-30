import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { signResetToken } from '@/lib/member-auth';

export const dynamic = 'force-dynamic';

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(req: Request) {
  const { siteId, email } = await req.json().catch(() => ({}));
  // 存在有無を漏らさないため常に ok を返す
  if (!siteId || !email) return NextResponse.json({ ok: true });

  const supabase = admin();
  const emailNorm = String(email).trim().toLowerCase();
  const { data: member } = await supabase
    .from('hp_members')
    .select('id')
    .eq('site_id', siteId)
    .eq('email', emailNorm)
    .maybeSingle();
  const { data: site } = await supabase.from('sites').select('name').eq('id', siteId).single();

  if (member && process.env.RESEND_API_KEY) {
    const token = signResetToken(member.id, siteId);
    const link = `${process.env.NEXT_PUBLIC_APP_URL || 'https://laruvisona.jp'}/hp/member-reset?site=${siteId}&token=${encodeURIComponent(token)}`;
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: `${site?.name || 'LARU HP'} <noreply@laruvisona.jp>`,
        to: emailNorm,
        subject: `【${site?.name || 'サイト'}】パスワード再設定`,
        html: `<div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="color:#0f172a;font-size:18px">パスワード再設定</h2>
          <p style="color:#475569;font-size:14px;line-height:1.7">下のボタンから新しいパスワードを設定してください（リンクは1時間有効）。心当たりがない場合は破棄してください。</p>
          <p style="margin:20px 0"><a href="${link}" style="display:inline-block;background:#0369a1;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 28px;border-radius:10px">パスワードを再設定</a></p>
          <p style="color:#94a3b8;font-size:12px;word-break:break-all">${link}</p>
        </div>`,
      });
    } catch (e) { console.error('[members/request-reset] mail failed:', (e as Error)?.message); }
  } else if (member) {
    console.log('[members/request-reset] RESEND未設定のためメール送信スキップ', emailNorm);
  }

  return NextResponse.json({ ok: true });
}
