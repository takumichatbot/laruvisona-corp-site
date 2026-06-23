import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function buildEmailHtml({
  type,
  siteName,
  name,
  email,
  phone,
  message,
  extraFields,
}: {
  type: string;
  siteName: string;
  name: string;
  email: string;
  phone?: string;
  message?: string;
  extraFields?: Record<string, string>;
}) {
  const isBooking = type === 'booking';
  const accentColor = isBooking ? '#8b5cf6' : '#3b82f6';
  const badge = isBooking ? '📅 予約リクエスト' : '✉️ お問い合わせ';
  const badgeBg = isBooking ? '#f5f3ff' : '#eff6ff';
  const badgeText = isBooking ? '#7c3aed' : '#1d4ed8';

  const row = (label: string, value: string) =>
    value
      ? `<tr>
          <td style="padding:10px 16px;background:#f8fafc;font-weight:600;font-size:13px;color:#475569;width:130px;border-bottom:1px solid #e2e8f0;vertical-align:top">${label}</td>
          <td style="padding:10px 16px;font-size:13px;color:#1e293b;border-bottom:1px solid #e2e8f0;white-space:pre-wrap;word-break:break-word">${value}</td>
        </tr>`
      : '';

  const extraRows = extraFields
    ? Object.entries(extraFields)
        .filter(([, v]) => v)
        .map(([k, v]) => {
          const labelMap: Record<string, string> = {
            company: '会社名・屋号',
            date: '希望日時',
            budget: '予算感',
            prefer_contact: '連絡方法',
          };
          return row(labelMap[k] || k, v);
        })
        .join('')
    : '';

  return `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Hiragino Sans','Yu Gothic UI','Segoe UI',sans-serif">
  <div style="max-width:600px;margin:40px auto;padding:0 16px">

    <!-- Header -->
    <div style="background:${accentColor};border-radius:12px 12px 0 0;padding:28px 32px">
      <div style="color:rgba(255,255,255,0.8);font-size:12px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:6px">LARU HP</div>
      <div style="color:#fff;font-size:22px;font-weight:700">${siteName}</div>
    </div>

    <!-- Badge -->
    <div style="background:#fff;padding:20px 32px 0">
      <span style="display:inline-block;background:${badgeBg};color:${badgeText};font-size:12px;font-weight:700;padding:4px 12px;border-radius:999px">${badge}</span>
    </div>

    <!-- Card -->
    <div style="background:#fff;padding:16px 32px 24px">
      <p style="color:#64748b;font-size:13px;margin:12px 0 16px">以下の内容でフォームの送信がありました。</p>

      <table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0">
        ${row('お名前', name)}
        ${row('メールアドレス', email)}
        ${row('電話番号', phone || '')}
        ${extraRows}
        ${row(isBooking ? '詳細・ご要望' : 'お問い合わせ内容', message || '')}
      </table>

      <!-- Reply button -->
      <div style="margin-top:24px;text-align:center">
        <a href="mailto:${email}?subject=Re: ${isBooking ? '予約リクエストのご確認' : 'お問い合わせありがとうございます'}"
           style="display:inline-block;background:${accentColor};color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 32px;border-radius:8px">
          ${name} 様に返信する →
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:16px 32px;text-align:center">
      <p style="color:#94a3b8;font-size:11px;margin:0">このメールは <strong>${siteName}</strong> のフォームから自動送信されました。<br>LARU HP · <a href="https://laruvisona.com" style="color:#94a3b8">laruvisona.com</a></p>
    </div>

  </div>
</body>
</html>`;
}

// Simple in-memory rate limiter: 5 submissions per IP per hour
const _rateMap = new Map<string, number[]>();
function checkRate(ip: string): boolean {
  const now = Date.now();
  const window = 60 * 60 * 1000; // 1 hour
  const limit = 5;
  const prev = (_rateMap.get(ip) ?? []).filter(t => now - t < window);
  if (prev.length >= limit) return false;
  _rateMap.set(ip, [...prev, now]);
  return true;
}

export async function POST(req: Request) {
  // Rate limiting
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
  if (!checkRate(ip)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  const { siteId, name, email, phone, message, type, extraFields, _hp } = await req.json();

  // Honeypot: bots fill hidden fields, humans don't
  if (_hp) return NextResponse.json({ ok: true });

  if (!siteId || !name || !email) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const supabase = getAdminClient();

  // Get site + owner email
  const { data: site } = await supabase
    .from('sites')
    .select('name, user_id, settings_json')
    .eq('id', siteId)
    .eq('published', true)
    .single();

  if (!site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  // Find active sequence to auto-enroll (stored in extra_fields to avoid schema dependency)
  const siteSettings = site.settings_json as Record<string, unknown> | null;
  const sequences = (siteSettings?.sequences as Array<{
    id: string; trigger: string; active: boolean;
    steps: Array<{ delay: number }>;
  }>) || [];
  const contactTrigger = (type === 'booking') ? 'booking' : 'contact_form';
  const matchedSeq = sequences.find(s => s.active && s.trigger === contactTrigger);

  const mergedExtraFields = {
    ...(extraFields || {}),
    ...(matchedSeq ? {
      _seq_id: matchedSeq.id,
      _seq_step: '0',
      _seq_next: new Date().toISOString(),
    } : {}),
  };

  // Save to DB — await so we can update with webhook result later
  const { data: contactRow } = await supabase.from('contacts').insert({
    site_id: siteId,
    type: type || 'contact',
    name,
    email,
    phone: phone || null,
    message: message || null,
    extra_fields: mergedExtraFields,
  }).select('id').single();

  // Get owner email from auth.users
  const { data: userData } = await supabase.auth.admin.getUserById(site.user_id);
  const settings = site.settings_json as Record<string, unknown> | null;
  const toEmail = (settings?.notifyEmail as string) || userData?.user?.email;

  if (!toEmail) {
    return NextResponse.json({ error: 'No notification email configured' }, { status: 400 });
  }

  // Send email via Resend
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Dev fallback: just log and return ok
    console.log('[Contact form]', { siteId, name, email, phone, message });
    return NextResponse.json({ ok: true });
  }

  const resend = new Resend(apiKey);
  const subject = type === 'booking'
    ? `【予約リクエスト】${site.name} — ${name} 様より`
    : `【お問い合わせ】${site.name} — ${name} 様より`;

  const html = buildEmailHtml({
    type: type || 'contact',
    siteName: site.name,
    name,
    email,
    phone,
    message,
    extraFields: extraFields as Record<string, string> | undefined,
  });

  const autoReplyHtml = `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Hiragino Sans','Yu Gothic UI','Segoe UI',sans-serif">
  <div style="max-width:600px;margin:40px auto;padding:0 16px">
    <div style="background:#1e40af;border-radius:12px 12px 0 0;padding:28px 32px">
      <div style="color:rgba(255,255,255,0.7);font-size:12px;font-weight:600;margin-bottom:6px">${site.name}</div>
      <div style="color:#fff;font-size:20px;font-weight:700">${type === 'booking' ? 'ご予約リクエストを受け付けました' : 'お問い合わせを受け付けました'}</div>
    </div>
    <div style="background:#fff;padding:28px 32px;border:1px solid #e2e8f0;border-top:none">
      <p style="color:#1e293b;font-size:15px;margin:0 0 16px">${name} 様</p>
      <p style="color:#475569;font-size:14px;line-height:1.7;margin:0 0 24px">
        ${type === 'booking'
          ? 'ご予約リクエストを承りました。内容を確認のうえ、担当者よりご連絡いたします。'
          : 'お問い合わせありがとうございます。内容を確認のうえ、担当者よりご連絡いたします。'}
      </p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;font-size:13px;color:#64748b">
        <div style="font-weight:600;color:#334155;margin-bottom:8px">送信内容</div>
        ${message ? `<div style="white-space:pre-wrap;line-height:1.6">${message}</div>` : '<div>—</div>'}
      </div>
    </div>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:16px 32px;text-align:center">
      <p style="color:#94a3b8;font-size:11px;margin:0">このメールは自動送信です。返信はできません。<br>${site.name} · Powered by <a href="https://laruvisona.com" style="color:#94a3b8">LARU HP</a></p>
    </div>
  </div>
</body>
</html>`;

  const lineToken = (settings?.lineNotifyToken as string) || '';
  const webhookUrl = (settings?.webhookUrl as string) || '';
  const lineMessage = `\n【${type === 'booking' ? '予約リクエスト' : 'お問い合わせ'}】${site.name}\nお名前: ${name}\nメール: ${email}${phone ? `\nTEL: ${phone}` : ''}${message ? `\nメッセージ: ${message.slice(0, 200)}` : ''}`;

  await Promise.all([
    resend.emails.send({
      from: 'LARU HP <noreply@laruvisona.jp>',
      to: toEmail,
      replyTo: email,
      subject,
      html,
    }),
    resend.emails.send({
      from: `${site.name} <noreply@laruvisona.jp>`,
      to: email,
      subject: type === 'booking'
        ? `【受付完了】ご予約リクエストを承りました — ${site.name}`
        : `【受付完了】お問い合わせを承りました — ${site.name}`,
      html: autoReplyHtml,
    }),
    ...(lineToken ? [
      fetch('https://notify-api.line.me/api/notify', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lineToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ message: lineMessage }),
      }).catch(() => {}),
    ] : []),
  ]);

  // Fire webhook and record delivery result in contact's extra_fields
  if (webhookUrl && contactRow?.id) {
    const webhookAt = new Date().toISOString();
    try {
      const whRes = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: type || 'contact', siteName: site.name, name, email, phone: phone || null, message: message || null, extraFields: extraFields || null }),
      });
      const whStatus = whRes.ok ? 'success' : 'failed';
      await supabase.from('contacts').update({
        extra_fields: { ...(extraFields || {}), webhook_status: whStatus, webhook_at: webhookAt, webhook_code: String(whRes.status) },
      }).eq('id', contactRow.id);
    } catch {
      await supabase.from('contacts').update({
        extra_fields: { ...(extraFields || {}), webhook_status: 'failed', webhook_at: webhookAt, webhook_code: 'error' },
      }).eq('id', contactRow.id);
    }
  }

  return NextResponse.json({ ok: true });
}
