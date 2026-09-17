import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { safeFetch } from '@/lib/safe-fetch';
import { escapeContactHtml, parseContactSubmission, readContactBody, singleLine } from '@/lib/contact-contract';
import { sendUserPush } from '@/lib/push-notification';
import { claimPublicRate } from '@/lib/public-rate-limit';
import { clientIp } from '@/lib/rate-limit';
import { verifySharedSecret } from '@/lib/shared-secret';

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
  const badge = isBooking ? '予約リクエスト' : 'お問い合わせ';
  const badgeBg = isBooking ? '#f5f3ff' : '#eff6ff';
  const badgeText = isBooking ? '#7c3aed' : '#1d4ed8';
  const safeSiteName = escapeContactHtml(siteName);
  const safeName = escapeContactHtml(name);
  const replyHref = escapeContactHtml(`mailto:${encodeURI(email)}?subject=${encodeURIComponent(`Re: ${isBooking ? '予約リクエストのご確認' : 'お問い合わせありがとうございます'}`)}`);

  const row = (label: string, value: string) =>
    value
      ? `<tr>
          <td style="padding:10px 16px;background:#f8fafc;font-weight:600;font-size:13px;color:#475569;width:130px;border-bottom:1px solid #e2e8f0;vertical-align:top">${escapeContactHtml(label)}</td>
          <td style="padding:10px 16px;font-size:13px;color:#1e293b;border-bottom:1px solid #e2e8f0;white-space:pre-wrap;word-break:break-word">${escapeContactHtml(value)}</td>
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
      <div style="color:#fff;font-size:22px;font-weight:700">${safeSiteName}</div>
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
        <a href="${replyHref}"
           style="display:inline-block;background:${accentColor};color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 32px;border-radius:8px">
          ${safeName} 様に返信する →
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:16px 32px;text-align:center">
      <p style="color:#94a3b8;font-size:11px;margin:0">このメールは <strong>${safeSiteName}</strong> のフォームから自動送信されました。<br>LARU HP · <a href="https://laruvisona.jp" style="color:#94a3b8">laruvisona.jp</a></p>
    </div>

  </div>
</body>
</html>`;
}

export async function POST(req: Request) {
  // 内部呼び出し（予約確定など）はレート制限をバイパス
  const internal = verifySharedSecret(req.headers.get('x-internal-secret'), process.env.RETENTION_SECRET);

  let raw: Record<string, unknown>;
  try {
    raw = await readContactBody(req);
  } catch (error) {
    const tooLarge = (error as Error).message === 'too_large';
    return NextResponse.json({ error: tooLarge ? '入力が長すぎます' : '入力を確認してください' }, { status: tooLarge ? 413 : 400 });
  }

  // Honeypot: bots fill hidden fields, humans don't
  if (raw._hp) return NextResponse.json({ ok: true });

  let submission;
  try {
    submission = parseContactSubmission(raw);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
  const { siteId, name, email, phone, message, type, extraFields } = submission;

  const supabase = getAdminClient();
  if (!internal) {
    const rate = await claimPublicRate(supabase, 'site-contact', `${siteId}:${clientIp(req)}`, 5);
    if (rate === 'limited') return NextResponse.json({ error: '送信回数が上限に達しました。時間をおいてお試しください。' }, { status: 429 });
    if (rate === 'unavailable') return NextResponse.json({ error: '受付を確認できません。時間をおいてお試しください。' }, { status: 503 });
  }

  // Get site + owner email
  const { data: site, error: siteError } = await supabase
    .from('sites')
    .select('name, user_id, settings_json')
    .eq('id', siteId)
    .eq('published', true)
    .single();

  if (siteError || !site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  const contactTrigger = (type === 'booking') ? 'booking' : 'contact_form';

  // Save to DB — await so we can update with webhook result later
  const { data: contactRow, error: contactError } = await supabase.from('contacts').insert({
    site_id: siteId,
    type: type || 'contact',
    name,
    email,
    phone: phone || null,
    message: message || null,
    extra_fields: extraFields || {},
  }).select('id').single();
  if (contactError || !contactRow) {
    console.error('[Contact] save failed:', contactError?.code || 'unknown');
    return NextResponse.json({ error: '受付内容を保存できませんでした。時間をおいてお試しください' }, { status: 503 });
  }

  // 自動フォローは問い合わせ保存後に専用キューへ登録する。失敗しても受付自体は失わない。
  const { error: sequenceError } = await supabase.rpc('laruhp_sequence_enroll', {
    p_contact: contactRow.id, p_site: siteId, p_trigger: contactTrigger,
  });
  if (sequenceError && sequenceError.code !== '42883') console.error('[Contact] sequence enrollment failed:', sequenceError.code || 'unknown');

  // Get owner email from auth.users
  const { data: userData } = await supabase.auth.admin.getUserById(site.user_id);
  const settings = site.settings_json as Record<string, unknown> | null;
  const toEmail = (settings?.notifyEmail as string) || userData?.user?.email;

  // Send email via Resend
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    await supabase.from('contacts').update({
      extra_fields: { ...(extraFields || {}), notification_at: new Date().toISOString(), owner_email_status: 'not_configured', customer_email_status: 'not_configured' },
    }).eq('id', contactRow.id);
    return NextResponse.json({ ok: true, notified: false });
  }

  const resend = new Resend(apiKey);
  const subject = singleLine(type === 'booking'
    ? `【予約リクエスト】${site.name} — ${name} 様より`
    : `【お問い合わせ】${site.name} — ${name} 様より`);

  const html = buildEmailHtml({
    type: type || 'contact',
    siteName: site.name,
    name,
    email,
    phone,
    message,
    extraFields: extraFields as Record<string, string> | undefined,
  });

  const safeSiteName = escapeContactHtml(site.name);
  const safeName = escapeContactHtml(name);
  const safeMessage = escapeContactHtml(message || '');
  const autoReplyHtml = `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Hiragino Sans','Yu Gothic UI','Segoe UI',sans-serif">
  <div style="max-width:600px;margin:40px auto;padding:0 16px">
    <div style="background:#1e40af;border-radius:12px 12px 0 0;padding:28px 32px">
      <div style="color:rgba(255,255,255,0.7);font-size:12px;font-weight:600;margin-bottom:6px">${safeSiteName}</div>
      <div style="color:#fff;font-size:20px;font-weight:700">${type === 'booking' ? 'ご予約リクエストを受け付けました' : 'お問い合わせを受け付けました'}</div>
    </div>
    <div style="background:#fff;padding:28px 32px;border:1px solid #e2e8f0;border-top:none">
      <p style="color:#1e293b;font-size:15px;margin:0 0 16px">${safeName} 様</p>
      <p style="color:#475569;font-size:14px;line-height:1.7;margin:0 0 24px">
        ${type === 'booking'
          ? 'ご予約リクエストを承りました。内容を確認のうえ、担当者よりご連絡いたします。'
          : 'お問い合わせありがとうございます。内容を確認のうえ、担当者よりご連絡いたします。'}
      </p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;font-size:13px;color:#64748b">
        <div style="font-weight:600;color:#334155;margin-bottom:8px">送信内容</div>
        ${message ? `<div style="white-space:pre-wrap;line-height:1.6">${safeMessage}</div>` : '<div>—</div>'}
      </div>
    </div>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:16px 32px;text-align:center">
      <p style="color:#94a3b8;font-size:11px;margin:0">このメールは自動送信です。返信はできません。<br>${safeSiteName} · Powered by <a href="https://laruvisona.jp" style="color:#94a3b8">LARU HP</a></p>
    </div>
  </div>
</body>
</html>`;

  // LINE Messaging API: lineNotifyToken に「チャネルアクセストークン\n送信先ID」を保持
  const lineRaw = (settings?.lineNotifyToken as string) || '';
  const [lineChannelToken, lineTarget] = lineRaw.split('\n').map(s => s.trim());
  const webhookUrl = (settings?.webhookUrl as string) || '';
  const lineMessage = `【${type === 'booking' ? '予約リクエスト' : 'お問い合わせ'}】${site.name}\nお名前: ${name}\nメール: ${email}${phone ? `\nTEL: ${phone}` : ''}${message ? `\nメッセージ: ${message.slice(0, 200)}` : ''}`;

  const deliveryResults = await Promise.all([
    // 送信の結果とあわせて、**Resend が付けた控え番号を残す。**
    // 2026-09-17: 店主あての通知が2回とも届かなかったのに、記録は success
    // だった。受け付けられた＝届いた、ではない。控え番号が無いと、
    // 「来ていない」と言われたときに追いかける手がかりが1つも無い。
    ...(toEmail ? [resend.emails.send({
      from: 'LARU HP <noreply@laruvisona.jp>',
      to: toEmail,
      replyTo: email,
      subject,
      html,
    }).then(result => ({ ok: !result.error, id: result.data?.id ?? null, channel: 'owner_email' as const }))
      .catch(() => ({ ok: false, id: null, channel: 'owner_email' as const }))] : []),
    resend.emails.send({
      from: 'LARU HP <noreply@laruvisona.jp>',
      to: email,
      subject: type === 'booking'
        ? `【受付完了】ご予約リクエストを承りました — ${site.name}`
        : `【受付完了】お問い合わせを承りました — ${site.name}`,
      html: autoReplyHtml,
    }).then(result => ({ ok: !result.error, id: result.data?.id ?? null, channel: 'customer_email' as const }))
      .catch(() => ({ ok: false, id: null, channel: 'customer_email' as const })),
    ...(lineChannelToken && lineTarget ? [
      fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lineChannelToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ to: lineTarget, messages: [{ type: 'text', text: lineMessage }] }),
        signal: AbortSignal.timeout(8_000),
      }).then(result => ({ ok: result.ok, id: null, channel: 'line' as const }))
        .catch(() => ({ ok: false, id: null, channel: 'line' as const })),
    ] : []),
  ]);

  // `accepted` は「メール配信の会社が受け付けた」という意味しかない。
  // 届いたかどうかは、あとから Resend の webhook（delivered / bounced）で入る。
  // ここで success と書いていたせいで、届いていないものが届いたように見えていた。
  const deliveryState = Object.fromEntries(deliveryResults.map(r => [r.channel, r.ok ? 'accepted' : 'failed']));
  const deliveryIds = Object.fromEntries(
    deliveryResults.filter(r => r.id).map(r => [`${r.channel}_id`, r.id as string]),
  );
  const deliveryAt = new Date().toISOString();
  const notificationFields = {
    ...(extraFields || {}),
    notification_at: deliveryAt,
    owner_email_status: deliveryState.owner_email || 'not_configured',
    customer_email_status: deliveryState.customer_email || 'not_configured',
    line_status: deliveryState.line || (lineChannelToken && lineTarget ? 'failed' : 'not_configured'),
    ...deliveryIds,
  };
  if (deliveryState.owner_email !== 'accepted') {
    // 店主に知らせが行かないのは、この製品でいちばん困る失敗。必ず記録に残す。
    console.error('[Contact] owner notification not accepted:', deliveryState.owner_email || 'no_recipient');
  }

  // Fire webhook and record delivery result in contact's extra_fields
  if (webhookUrl && contactRow?.id) {
    const webhookAt = new Date().toISOString();
    try {
      // Webhook先はテナントが自由に入れられるので、内部ネットワークへ
      // 飛ばされないよう safeFetch を通す。
      const whRes = await safeFetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: type || 'contact', siteName: site.name, name, email, phone: phone || null, message: message || null, extraFields: extraFields || null }),
      }, { timeoutMs: 8000, maxRedirects: 2 });
      const whStatus = whRes.ok ? 'success' : 'failed';
      await supabase.from('contacts').update({
        extra_fields: { ...notificationFields, webhook_status: whStatus, webhook_at: webhookAt, webhook_code: String(whRes.status) },
      }).eq('id', contactRow.id);
    } catch {
      await supabase.from('contacts').update({
        extra_fields: { ...notificationFields, webhook_status: 'failed', webhook_at: webhookAt, webhook_code: 'error' },
      }).eq('id', contactRow.id);
    }
  } else {
    const saved = await supabase.from('contacts').update({ extra_fields: notificationFields }).eq('id', contactRow.id);
    // ここに配信IDを残せないと、あとから来る webhook（届いた／戻ってきた）が
    // この受付に結び付けられない。状態は永久に「受け付けました」のまま止まる。
    if (saved.error) console.error('[Contact] delivery ids not recorded:', contactRow.id, saved.error.message);
  }

  const push = await sendUserPush(site.user_id, {
    title: `${site.name}に${type === 'booking' ? '予約リクエスト' : 'お問い合わせ'}`,
    body: '新しい受付内容を管理画面で確認してください。',
    url: `/laruHP/contacts?site=${encodeURIComponent(siteId)}`,
    tag: `contact-${contactRow.id}`,
  }, supabase);
  // メールとLINEは状態を残しているのに、プッシュだけ何も残していなかった。
  // 「スマホに出るはず」と思っている店主が、出ていないことに気づけない。
  if (push && push.sent === 0 && push.failed > 0) {
    console.error('[Contact] push notification failed for all devices:', contactRow.id, push);
  }
  /*
    notified は「店主に知らせられたか」。

    ここが 'success' と比べていた。ところが deliveryState が取る値は
    'accepted' / 'failed' / 'not_configured' の3つだけで、**'success' は
    絶対に作られない。** つまりこの旗は、いつ見ても false だった。

    そのままでは害が見えにくいが、通る道がある。

      お客様が予約する
        → /api/hp/booking/reserve
        → lib/booking-finalize.ts が、ここ（/api/contact）を内側で叩く
        → 店主あてメールが失敗しても、HTTPは200なので finalize は true を返す
        → reserve は notified: true を返す
        → components/scheduling/PublicBooking.tsx は
          data.notified === false のときだけ「通知に失敗」を出す

    結果: **予約は入ったのに店主は知らず、お客様には「送信できました」と出る。**
    当日、誰も来ない。どちらにも、何が起きたか分からない。

    'accepted' は「メール配信の会社が受け取った」まで。届いたかは
    あとから webhook（delivered / bounced）で入る。ここで言えるのはそこまで。
  */
  const ownerNotifyState = deliveryState.owner_email || 'not_configured';
  return NextResponse.json({
    ok: true,
    notified: ownerNotifyState === 'accepted',
    ownerNotifyState,
  });
}
