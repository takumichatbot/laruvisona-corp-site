import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { escapeContactHtml, readContactBody, singleLine } from '@/lib/contact-contract';
import { createClient } from '@supabase/supabase-js';
import { claimPublicRate } from '@/lib/public-rate-limit';
import { clientIp } from '@/lib/rate-limit';

// コーポレートサイトのお問い合わせ（LaruVisona宛にメール送信）。
// 公開サイトのフォーム(/api/contact)とは別。siteId 不要。
const COMPANY_EMAIL = process.env.INQUIRY_EMAIL || process.env.ADMIN_EMAIL || 'info@laruvisona.jp';

function database() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(req: Request) {
  let input: Record<string, unknown>;
  try { input = await readContactBody(req, 20_000); }
  catch (error) { return NextResponse.json({ error: (error as Error).message === 'too_large' ? '入力が長すぎます' : '入力を確認してください' }, { status: 400 }); }
  const { _hp } = input;
  if (_hp) return NextResponse.json({ ok: true }); // ハニーポット
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const message = typeof input.message === 'string' ? input.message.trim() : '';
  const company = typeof input.company === 'string' ? input.company.trim() : '';
  if (!name || name.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !message || message.length > 10_000 || company.length > 200) {
    return NextResponse.json({ error: 'お名前・メール・お問い合わせ内容は必須です' }, { status: 400 });
  }
  const rate = await claimPublicRate(database(), 'company-inquiry', clientIp(req), 5);
  if (rate === 'limited') return NextResponse.json({ error: '送信回数が上限に達しました。時間をおいてお試しください。' }, { status: 429 });
  if (rate === 'unavailable') return NextResponse.json({ error: '受付を確認できません。時間をおいてお試しください。' }, { status: 503 });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: '送信機能を利用できません' }, { status: 503 });
  }

  const html = `<!DOCTYPE html><html lang="ja"><body style="margin:0;background:#f1f5f9;font-family:-apple-system,'Hiragino Sans',sans-serif">
    <div style="max-width:600px;margin:40px auto;padding:0 16px">
      <div style="background:#0f172a;border-radius:12px 12px 0 0;padding:24px 32px">
        <div style="color:#93c5fd;font-size:12px;font-weight:700;letter-spacing:.05em">LaruVisona</div>
        <div style="color:#fff;font-size:20px;font-weight:700">サイトからお問い合わせ</div>
      </div>
      <div style="background:#fff;border:1px solid #e2e8f0;border-top:none;padding:24px 32px">
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:8px 0;color:#64748b;width:120px">お名前</td><td style="padding:8px 0;color:#0f172a">${escapeContactHtml(name)}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b">メール</td><td style="padding:8px 0;color:#0f172a">${escapeContactHtml(email)}</td></tr>
          ${company ? `<tr><td style="padding:8px 0;color:#64748b">会社名</td><td style="padding:8px 0;color:#0f172a">${escapeContactHtml(company)}</td></tr>` : ''}
        </table>
        <div style="margin-top:16px;padding-top:16px;border-top:1px solid #f1f5f9;white-space:pre-wrap;color:#1e293b;font-size:14px;line-height:1.7">${escapeContactHtml(message)}</div>
        <div style="margin-top:20px"><a href="mailto:${escapeContactHtml(email)}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:10px 24px;border-radius:8px">${escapeContactHtml(name)} 様に返信</a></div>
      </div>
    </div></body></html>`;

  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: 'LaruVisona <noreply@laruvisona.jp>',
      to: COMPANY_EMAIL,
      replyTo: email,
      subject: `【お問い合わせ】${singleLine(name)} 様より`,
      html,
    });
    if (result.error) throw new Error('resend rejected');
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[inquiry] send failed:', (e as Error)?.message);
    return NextResponse.json({ error: '送信に失敗しました。時間をおいてお試しください。' }, { status: 500 });
  }
}
