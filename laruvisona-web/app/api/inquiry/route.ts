import { NextResponse } from 'next/server';
import { Resend } from 'resend';

// コーポレートサイトのお問い合わせ（LARUVisona宛にメール送信）。
// 公開サイトのフォーム(/api/contact)とは別。siteId 不要。
const COMPANY_EMAIL = process.env.ADMIN_EMAIL || 'laruvisona@gmail.com';

// 簡易レート制限: 同一IP 1時間に5件
const _rateMap = new Map<string, number[]>();
function checkRate(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const prev = (_rateMap.get(ip) ?? []).filter(t => now - t < windowMs);
  if (prev.length >= 5) return false;
  _rateMap.set(ip, [...prev, now]);
  return true;
}

function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function POST(req: Request) {
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
  if (!checkRate(ip)) {
    return NextResponse.json({ error: '送信回数が上限に達しました。時間をおいてお試しください。' }, { status: 429 });
  }

  const { name, email, message, company, _hp } = await req.json().catch(() => ({}));
  if (_hp) return NextResponse.json({ ok: true }); // ハニーポット
  if (!name || !email || !message) {
    return NextResponse.json({ error: 'お名前・メール・お問い合わせ内容は必須です' }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // 開発/ステージング: メールキー未設定でも成功扱い（ログのみ）
    console.log('[inquiry]', { name, email, company, message });
    return NextResponse.json({ ok: true });
  }

  const html = `<!DOCTYPE html><html lang="ja"><body style="margin:0;background:#f1f5f9;font-family:-apple-system,'Hiragino Sans',sans-serif">
    <div style="max-width:600px;margin:40px auto;padding:0 16px">
      <div style="background:#0f172a;border-radius:12px 12px 0 0;padding:24px 32px">
        <div style="color:#93c5fd;font-size:12px;font-weight:700;letter-spacing:.05em">LARUVisona</div>
        <div style="color:#fff;font-size:20px;font-weight:700">サイトからお問い合わせ</div>
      </div>
      <div style="background:#fff;border:1px solid #e2e8f0;border-top:none;padding:24px 32px">
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:8px 0;color:#64748b;width:120px">お名前</td><td style="padding:8px 0;color:#0f172a">${esc(name)}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b">メール</td><td style="padding:8px 0;color:#0f172a">${esc(email)}</td></tr>
          ${company ? `<tr><td style="padding:8px 0;color:#64748b">会社名</td><td style="padding:8px 0;color:#0f172a">${esc(company)}</td></tr>` : ''}
        </table>
        <div style="margin-top:16px;padding-top:16px;border-top:1px solid #f1f5f9;white-space:pre-wrap;color:#1e293b;font-size:14px;line-height:1.7">${esc(message)}</div>
        <div style="margin-top:20px"><a href="mailto:${esc(email)}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:10px 24px;border-radius:8px">${esc(name)} 様に返信</a></div>
      </div>
    </div></body></html>`;

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: 'LARUVisona <noreply@laruvisona.jp>',
      to: COMPANY_EMAIL,
      replyTo: email,
      subject: `【お問い合わせ】${name} 様より`,
      html,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[inquiry] send failed:', (e as Error)?.message);
    return NextResponse.json({ error: '送信に失敗しました。時間をおいてお試しください。' }, { status: 500 });
  }
}
