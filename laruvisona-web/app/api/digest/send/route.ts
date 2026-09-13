import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { Resend } from 'resend';
import {
  claimScheduledEmail, escapeEmailHtml, finishScheduledEmail, isoWeekKey, requireBearer,
} from '@/lib/scheduled-email';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://laruvisona.jp';

function buildDigestHtml(input: {
  userName: string; totalViews: number; viewChange: number; unreadContacts: number;
  publishedSites: number; unpublishedSites: number;
}) {
  const name = escapeEmailHtml(input.userName);
  const change = input.viewChange > 0 ? `+${input.viewChange}` : String(input.viewChange);
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f5f7fa;font-family:Arial,'Hiragino Sans','Yu Gothic',sans-serif;color:#172033">
<div style="max-width:560px;margin:32px auto;padding:0 16px">
<div style="background:#071426;color:#fff;padding:30px 32px;border-radius:16px 16px 0 0"><div style="font-weight:800">LARU HP</div><h1 style="font-size:22px;margin:16px 0 4px">${name}さん、今週のサイトレポート</h1><p style="margin:0;color:#b8c6da;font-size:13px">直近7日間の実績です</p></div>
<div style="background:#fff;padding:28px 32px;border-radius:0 0 16px 16px;border:1px solid #e3e8ef;border-top:0">
<table role="presentation" style="width:100%;border-collapse:collapse"><tr>
<td style="padding:14px;background:#f5f8fc"><strong style="font-size:24px">${input.totalViews.toLocaleString()}</strong><br><span style="font-size:12px;color:#607086">訪問数</span></td>
<td style="padding:14px;background:#f5f8fc"><strong style="font-size:24px">${input.unreadContacts}</strong><br><span style="font-size:12px;color:#607086">未読の問い合わせ</span></td>
<td style="padding:14px;background:#f5f8fc"><strong style="font-size:24px">${input.publishedSites}</strong><br><span style="font-size:12px;color:#607086">公開サイト</span></td>
</tr></table>
<p style="font-size:14px;line-height:1.7">前週との差は <strong>${change}件</strong> です。${input.unpublishedSites > 0 ? `未公開のサイトが${input.unpublishedSites}件あります。` : ''}</p>
${input.unreadContacts > 0 ? `<p><a href="${APP_URL}/laruHP/contacts" style="color:#0758a6">未読の問い合わせを確認する</a></p>` : ''}
<a href="${APP_URL}/laruHP/dashboard" style="display:block;text-align:center;background:#0b62bd;color:#fff;text-decoration:none;font-weight:700;padding:15px;border-radius:10px">ダッシュボードを開く</a>
<p style="margin:20px 0 0;font-size:12px;color:#738096">週次レポートはLARU HPの設定から停止できます。</p>
</div></div></body></html>`;
}

export async function POST(req: Request) {
  if (!requireBearer(req, process.env.RETENTION_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: 'RESEND_API_KEY not set' }, { status: 503 });

  const service = createServiceClient();
  const profilesResult = await service.from('profiles').select('id').eq('subscription_status', 'active').eq('digest_enabled', true);
  if (profilesResult.error) return NextResponse.json({ error: 'profiles unavailable' }, { status: 503 });

  const resend = new Resend(process.env.RESEND_API_KEY);
  const now = Date.now();
  const weekAgo = new Date(now - 7 * 86_400_000).toISOString().slice(0, 10);
  const twoWeeksAgo = new Date(now - 14 * 86_400_000).toISOString().slice(0, 10);
  const key = isoWeekKey();
  let sent = 0;
  const failed: string[] = [];

  for (const profile of profilesResult.data || []) {
    let claim: { delivery_id: string; claim_token: string } | undefined;
    try {
      claim = await claimScheduledEmail(service, profile.id, 'weekly_digest', key);
      if (!claim) continue;

      const [userResult, sitesResult] = await Promise.all([
        service.auth.admin.getUserById(profile.id),
        service.from('sites').select('id,published').eq('user_id', profile.id),
      ]);
      if (userResult.error || sitesResult.error) throw new Error('recipient data unavailable');
      const user = userResult.data.user;
      if (!user?.email) throw new Error('recipient email unavailable');
      const sites = sitesResult.data || [];
      const siteIds = sites.map(site => site.id);

      let currentViews = 0;
      let previousViews = 0;
      let unreadContacts = 0;
      if (siteIds.length) {
        const [currentResult, previousResult, contactResult] = await Promise.all([
          service.from('daily_views').select('views').in('site_id', siteIds).gte('date', weekAgo),
          service.from('daily_views').select('views').in('site_id', siteIds).gte('date', twoWeeksAgo).lt('date', weekAgo),
          service.from('contacts').select('id', { count: 'exact', head: true }).in('site_id', siteIds).eq('read', false),
        ]);
        if (currentResult.error || previousResult.error || contactResult.error) throw new Error('report data unavailable');
        currentViews = (currentResult.data || []).reduce((sum, row) => sum + Number(row.views || 0), 0);
        previousViews = (previousResult.data || []).reduce((sum, row) => sum + Number(row.views || 0), 0);
        unreadContacts = contactResult.count || 0;
      }

      const userName = String(user.user_metadata?.name || user.email.split('@')[0]).slice(0, 80);
      const response = await resend.emails.send({
        from: 'LARU HP <noreply@laruvisona.jp>', to: user.email,
        subject: `【LARU HP】今週のサイトレポート（訪問${currentViews}件）`,
        html: buildDigestHtml({
          userName, totalViews: currentViews, viewChange: currentViews - previousViews,
          unreadContacts, publishedSites: sites.filter(s => s.published).length,
          unpublishedSites: sites.filter(s => !s.published).length,
        }),
      }, { idempotencyKey: `hp-weekly-${claim.delivery_id}` });
      if (response.error) throw new Error(response.error.message);
      await finishScheduledEmail(service, claim, true, response.data?.id);
      sent++;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'send failed';
      failed.push(profile.id);
      if (claim) {
        try { await finishScheduledEmail(service, claim, false, undefined, message); } catch {}
      }
    }
  }
  return NextResponse.json({ sent, failed, total: profilesResult.data?.length || 0 }, { status: failed.length ? 503 : 200 });
}
