import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { Resend } from 'resend';
import { claimScheduledEmail, finishScheduledEmail, requireBearer } from '@/lib/scheduled-email';

// Called by a daily cron (e.g., Render cron job or external scheduler).
// Checks profiles and sends Day-1 / Day-7 / Day-25 onboarding emails.
// Requires: Authorization: Bearer <RETENTION_SECRET> header.

const DAY_MS = 86_400_000;

function daysSince(isoDate: string) {
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / DAY_MS);
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://laruvisona.jp';

function emailDay1(plan: string) {
  const planLabel = plan === 'hp' ? 'HP プラン' : plan === 'lite' ? 'HP + LARUbot Lite' : plan === 'hp-bot' ? 'HP + Bot Standard' : plan === 'hp-bot-seo' ? 'HP + Bot + SEO' : 'エージェンシー';
  return {
    subject: '【LARU HP】サイト公開まであと3ステップ',
    html: `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f0f9ff;font-family:'Helvetica Neue',Arial,sans-serif">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06)">
    <div style="background:linear-gradient(135deg,#0369a1,#0ea5e9);padding:36px 40px">
      <div style="font-size:16px;font-weight:900;color:white;margin-bottom:16px">LARU<span style="font-weight:300">HP</span></div>
      <h1 style="color:white;font-size:20px;font-weight:800;margin:0">サイト公開まであと3ステップ！</h1>
    </div>
    <div style="padding:36px 40px">
      <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 24px">${planLabel}へのご契約ありがとうございます。<br>まずはサイトを公開しましょう。</p>
      <div style="space-y:12px">
        ${[
          ['1', '制作スタジオで4つの質問に答える', `${APP_URL}/laruHP/studio`],
          ['2', '実際の完成像を見ながら内容を整える', `${APP_URL}/laruHP/studio`],
          ['3', '「公開する」ボタンを押す', `${APP_URL}/laruHP/dashboard`],
        ].map(([n, label, url]) => `
        <a href="${url}" style="display:flex;align-items:center;gap:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;margin-bottom:10px;text-decoration:none">
          <div style="width:28px;height:28px;background:#0ea5e9;color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px;flex-shrink:0">${n}</div>
          <span style="color:#374151;font-size:14px;font-weight:600">${label}</span>
        </a>`).join('')}
      </div>
      <a href="${APP_URL}/laruHP/dashboard" style="display:block;text-align:center;background:linear-gradient(135deg,#0369a1,#0ea5e9);color:white;font-weight:800;font-size:15px;text-decoration:none;padding:16px 24px;border-radius:12px;margin-top:24px">ダッシュボードを開く →</a>
    </div>
    <div style="background:#f8fafc;padding:16px 40px;text-align:center">
      <p style="color:#9ca3af;font-size:12px;margin:0">ご不明な点は <a href="mailto:info@laruvisona.jp" style="color:#0ea5e9;text-decoration:none">info@laruvisona.jp</a> まで</p>
    </div>
  </div>
</body></html>`,
  };
}

function emailDay7() {
  return {
    subject: '【LARU HP】今週のサイトレポート',
    html: `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f0f9ff;font-family:'Helvetica Neue',Arial,sans-serif">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06)">
    <div style="background:linear-gradient(135deg,#0369a1,#0ea5e9);padding:36px 40px">
      <div style="font-size:16px;font-weight:900;color:white;margin-bottom:16px">LARU<span style="font-weight:300">HP</span></div>
      <h1 style="color:white;font-size:20px;font-weight:800;margin:0">ご利用1週間、ありがとうございます</h1>
    </div>
    <div style="padding:36px 40px">
      <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 24px">サイトは順調に動いていますか？ダッシュボードでアクセス数や問い合わせを確認できます。</p>
      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:20px 24px;margin-bottom:24px">
        <div style="font-weight:700;color:#0369a1;margin-bottom:12px;font-size:14px">おすすめの次のステップ</div>
        ${[
          ['独自ドメインを設定する', '信頼感がアップし、SEOにも有利です', `${APP_URL}/laruHP/dashboard`],
          ['アクセス解析を確認する', 'どこからの流入が多いか把握しましょう', `${APP_URL}/laruHP/analytics`],
          ['メルマガ読者を集める', '訪問者にメール登録を促しましょう', `${APP_URL}/laruHP/newsletter`],
        ].map(([title, desc, url]) => `
        <a href="${url}" style="display:block;margin-bottom:10px;text-decoration:none">
          <div style="font-size:13px;font-weight:700;color:#0f172a">${title}</div>
          <div style="font-size:12px;color:#64748b">${desc}</div>
        </a>`).join('')}
      </div>
      <a href="${APP_URL}/laruHP/dashboard" style="display:block;text-align:center;background:linear-gradient(135deg,#0369a1,#0ea5e9);color:white;font-weight:800;font-size:15px;text-decoration:none;padding:16px 24px;border-radius:12px">ダッシュボードを確認する →</a>
    </div>
  </div>
</body></html>`,
  };
}

function emailDay25() {
  return {
    subject: '【LARU HP】来月の請求について',
    html: `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f0f9ff;font-family:'Helvetica Neue',Arial,sans-serif">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06)">
    <div style="background:linear-gradient(135deg,#0369a1,#0ea5e9);padding:36px 40px">
      <div style="font-size:16px;font-weight:900;color:white;margin-bottom:16px">LARU<span style="font-weight:300">HP</span></div>
      <h1 style="color:white;font-size:20px;font-weight:800;margin:0">来月から通常料金が始まります</h1>
    </div>
    <div style="padding:36px 40px">
      <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px">初月無料期間が間もなく終了します。引き続きご利用いただける場合は、登録済みのカードに自動で請求されます。</p>
      <div style="background:#fefce8;border:1px solid #fde68a;border-radius:12px;padding:16px 20px;margin-bottom:24px;color:#92400e;font-size:13px;line-height:1.6">
        解約をご希望の場合は、最低契約期間（6ヶ月）終了後に<br>「サブスクリプション管理」からお手続きいただけます。
      </div>
      <p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 24px">引き続きご活用いただくために、困ったことがあればいつでもサポートへご連絡ください。</p>
      <a href="${APP_URL}/laruHP/settings" style="display:block;text-align:center;background:linear-gradient(135deg,#0369a1,#0ea5e9);color:white;font-weight:800;font-size:15px;text-decoration:none;padding:16px 24px;border-radius:12px">プラン・請求を確認する →</a>
    </div>
    <div style="background:#f8fafc;padding:16px 40px;text-align:center">
      <p style="color:#9ca3af;font-size:12px;margin:0">ご不明な点は <a href="mailto:info@laruvisona.jp" style="color:#0ea5e9;text-decoration:none">info@laruvisona.jp</a> まで</p>
    </div>
  </div>
</body></html>`,
  };
}

export async function POST(req: Request) {
  if (!requireBearer(req, process.env.RETENTION_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'RESEND_API_KEY not set' }, { status: 503 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const service = createServiceClient();

  // Fetch all active subscriptions with contract start dates
  const profilesResult = await service
    .from('profiles')
    .select('id, plan, contract_starts_at')
    .eq('subscription_status', 'active')
    .not('contract_starts_at', 'is', null);

  if (profilesResult.error) return NextResponse.json({ error: 'profiles unavailable' }, { status: 503 });
  const profiles = profilesResult.data || [];
  if (!profiles.length) return NextResponse.json({ sent: 0 });

  let sent = 0;
  const failed: string[] = [];

  for (const profile of profiles) {
    const days = daysSince(profile.contract_starts_at);
    const toSend: { day: string; email: { subject: string; html: string } }[] = [];
    // 移行時に古い契約へ3通まとめて送らない。各便は5日間だけ再試行する。
    if (days >= 1 && days <= 5) toSend.push({ day: 'day1', email: emailDay1(profile.plan || 'hp') });
    if (days >= 7 && days <= 11) toSend.push({ day: 'day7', email: emailDay7() });
    if (days >= 25 && days <= 29) toSend.push({ day: 'day25', email: emailDay25() });

    if (toSend.length === 0) continue;

    const userResult = await service.auth.admin.getUserById(profile.id);
    if (userResult.error || !userResult.data.user?.email) {
      failed.push(profile.id);
      continue;
    }
    const user = userResult.data.user;
    const recipientEmail = user.email!;
    const periodKey = String(profile.contract_starts_at).slice(0, 10);

    for (const { day, email } of toSend) {
      let claim: { delivery_id: string; claim_token: string } | undefined;
      try {
        claim = await claimScheduledEmail(service, profile.id, `retention_${day}`, periodKey);
        if (!claim) continue;
        const response = await resend.emails.send({
          from: 'LARU HP <noreply@laruvisona.jp>', to: recipientEmail,
          subject: email.subject, html: email.html,
        }, { idempotencyKey: `hp-retention-${claim.delivery_id}` });
        if (response.error) throw new Error(response.error.message);
        await finishScheduledEmail(service, claim, true, response.data?.id);
        sent++;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'send failed';
        failed.push(`${profile.id}:${day}`);
        if (claim) {
          try { await finishScheduledEmail(service, claim, false, undefined, message); } catch {}
        }
      }
    }
  }

  return NextResponse.json({ sent, failed }, { status: failed.length ? 503 : 200 });
}
