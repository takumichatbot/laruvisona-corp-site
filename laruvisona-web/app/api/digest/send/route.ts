import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { Resend } from 'resend';

// Weekly digest email: send every Monday at 9:00 JST via external cron
// Authorization: Bearer <RETENTION_SECRET>

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://laruvisona.jp';

function buildDigestHtml({
  userName,
  totalViews,
  viewChange,
  unreadContacts,
  publishedSites,
  unpublishedSites,
  tipTitle,
  tipBody,
}: {
  userName: string;
  totalViews: number;
  viewChange: number;
  unreadContacts: number;
  publishedSites: number;
  unpublishedSites: number;
  tipTitle: string;
  tipBody: string;
}) {
  const changeSign = viewChange >= 0 ? '+' : '';
  const changeColor = viewChange >= 0 ? '#16a34a' : '#dc2626';
  const changeBg = viewChange >= 0 ? '#f0fdf4' : '#fef2f2';

  const statCard = (label: string, value: string | number, sub?: string, color = '#0369a1') =>
    `<div style="flex:1;min-width:0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;text-align:center">
      <div style="font-size:26px;font-weight:900;color:${color};margin-bottom:2px">${value}</div>
      <div style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">${label}</div>
      ${sub ? `<div style="font-size:10px;color:#94a3b8;margin-top:2px">${sub}</div>` : ''}
    </div>`;

  return `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f9ff;font-family:'Helvetica Neue',Arial,sans-serif">
  <div style="max-width:560px;margin:40px auto">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0369a1,#0ea5e9);border-radius:16px 16px 0 0;padding:32px 40px">
      <div style="font-size:15px;font-weight:900;color:white;margin-bottom:12px">LARU<span style="font-weight:300">HP</span></div>
      <h1 style="color:white;font-size:19px;font-weight:800;margin:0;line-height:1.4">
        ${userName}さん、今週のサイトレポート
      </h1>
      <p style="color:rgba(255,255,255,0.7);font-size:12px;margin:6px 0 0">
        ${new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })} 時点
      </p>
    </div>

    <!-- Body -->
    <div style="background:#fff;padding:32px 40px">

      <!-- Stats -->
      <div style="display:flex;gap:12px;margin-bottom:24px">
        ${statCard('今週の訪問数', totalViews.toLocaleString(), '過去7日間')}
        ${statCard('未読の問い合わせ', unreadContacts, unreadContacts > 0 ? '返信をお忘れなく' : '', unreadContacts > 0 ? '#dc2626' : '#16a34a')}
        ${statCard('公開サイト', publishedSites, `未公開: ${unpublishedSites}件`)}
      </div>

      <!-- View change pill -->
      ${totalViews > 0 ? `
      <div style="background:${changeBg};border-radius:8px;padding:10px 16px;margin-bottom:24px;display:flex;align-items:center;gap:8px">
        <span style="font-size:18px">${viewChange >= 0 ? '📈' : '📉'}</span>
        <span style="font-size:13px;color:#374151">前週比 <strong style="color:${changeColor}">${changeSign}${viewChange}件</strong> の訪問</span>
      </div>` : ''}

      <!-- Unread contacts CTA -->
      ${unreadContacts > 0 ? `
      <a href="${APP_URL}/laruHP/contacts" style="display:flex;align-items:center;justify-content:space-between;background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:14px 18px;text-decoration:none;margin-bottom:24px">
        <div>
          <div style="font-weight:700;font-size:13px;color:#c2410c">📬 未読の問い合わせが${unreadContacts}件あります</div>
          <div style="font-size:11px;color:#9a3412;margin-top:2px">早めの返信が顧客満足度を高めます</div>
        </div>
        <div style="color:#ea580c;font-size:12px;font-weight:700;flex-shrink:0;margin-left:12px">確認 →</div>
      </a>` : ''}

      <!-- Tip of the week -->
      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:20px 24px;margin-bottom:28px">
        <div style="font-size:11px;font-weight:700;color:#0369a1;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px">💡 今週のアドバイス</div>
        <div style="font-weight:700;font-size:14px;color:#0f172a;margin-bottom:6px">${tipTitle}</div>
        <div style="font-size:13px;color:#475569;line-height:1.6">${tipBody}</div>
      </div>

      <!-- Unpublished nudge -->
      ${unpublishedSites > 0 ? `
      <a href="${APP_URL}/laruHP/dashboard" style="display:flex;align-items:center;gap:12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:14px 18px;text-decoration:none;margin-bottom:24px">
        <span style="font-size:22px">🚀</span>
        <div>
          <div style="font-weight:700;font-size:13px;color:#15803d">未公開のサイトが${unpublishedSites}件あります</div>
          <div style="font-size:11px;color:#166534;margin-top:2px">公開するとGoogleに認識され、集客が始まります</div>
        </div>
      </a>` : ''}

      <!-- CTA button -->
      <a href="${APP_URL}/laruHP/dashboard" style="display:block;text-align:center;background:linear-gradient(135deg,#0369a1,#0ea5e9);color:white;font-weight:800;font-size:15px;text-decoration:none;padding:16px 24px;border-radius:12px;margin-bottom:24px">
        ダッシュボードを開く →
      </a>

      <!-- Quick links -->
      <div style="border-top:1px solid #f1f5f9;padding-top:20px;display:flex;gap:8px;flex-wrap:wrap;justify-content:center">
        ${[
          ['✏️ サイトを編集', `${APP_URL}/laruHP/builder`],
          ['📊 アクセス解析', `${APP_URL}/laruHP/settings?section=gsc`],
          ['📣 メルマガ', `${APP_URL}/laruHP/newsletter`],
        ].map(([label, url]) =>
          `<a href="${url}" style="font-size:12px;color:#0369a1;text-decoration:none;background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:6px 12px">${label}</a>`
        ).join('')}
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;border-radius:0 0 16px 16px;padding:16px 40px;text-align:center">
      <p style="color:#9ca3af;font-size:11px;margin:0 0 4px">
        このメールはLARU HPからお送りしています
      </p>
      <p style="color:#9ca3af;font-size:11px;margin:0">
        <a href="${APP_URL}/laruHP/settings" style="color:#0ea5e9;text-decoration:none">配信停止</a>
        &nbsp;·&nbsp;
        <a href="mailto:support@laruvisona.jp" style="color:#0ea5e9;text-decoration:none">support@laruvisona.jp</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

const TIPS = [
  {
    title: 'CTAボタンのテキストを見直す',
    body: '「お問い合わせ」より「無料で相談する」の方がクリック率が平均2.3倍高い傾向があります。ビルダーでボタンテキストを変えてみましょう。',
  },
  {
    title: 'Googleビジネスプロフィールに写真を追加する',
    body: '写真が10枚以上あるお店はマップ検索のクリック率が平均35%高くなります。外観・内装・商品写真を追加しましょう。',
  },
  {
    title: '口コミ返信でSEO効果アップ',
    body: 'Googleの口コミに返信するとGoogleマップの表示順位が向上します。全ての口コミに24時間以内に返信することを目標にしましょう。',
  },
  {
    title: 'サービス料金を明示する',
    body: '料金を公開しているサイトは問い合わせ数が平均1.8倍。「要お見積もり」でも目安を示すだけで効果があります。',
  },
  {
    title: 'ページ読み込み速度を改善する',
    body: '1秒遅くなるごとにコンバージョン率が7%低下します。画像は必ずWebP形式・500KB以下に圧縮しましょう。',
  },
];

export async function POST(req: Request) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (secret !== process.env.RETENTION_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'RESEND_API_KEY not set' }, { status: 503 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const service = await createServiceClient();

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86_400_000).toISOString();

  const tip = TIPS[now.getDay() % TIPS.length];

  // Fetch active profiles with opt-in (digest_enabled is null/true means enabled)
  const { data: profiles } = await service
    .from('profiles')
    .select('id, digest_last_sent, digest_enabled')
    .eq('subscription_status', 'active')
    .or('digest_enabled.is.null,digest_enabled.eq.true');

  if (!profiles?.length) return NextResponse.json({ sent: 0 });

  let sent = 0;
  const errors: string[] = [];

  for (const profile of profiles) {
    // Skip if sent in the last 6 days (prevent double-send)
    if (profile.digest_last_sent && new Date(profile.digest_last_sent) > new Date(now.getTime() - 6 * 86_400_000)) {
      continue;
    }

    const { data: { user } } = await service.auth.admin.getUserById(profile.id);
    if (!user?.email) continue;

    const userName = user.user_metadata?.name || user.email.split('@')[0];

    // Fetch sites
    const { data: sites } = await service.from('sites').select('id, name, published, view_count').eq('user_id', profile.id);
    const published = (sites || []).filter(s => s.published);
    const unpublished = (sites || []).filter(s => !s.published);

    // Fetch view counts for this week and last week from site view_count aggregate
    // Use the page_views table if available, fallback to view_count sum
    let thisWeekViews = 0;
    let lastWeekViews = 0;

    const siteIds = (sites || []).map(s => s.id);
    if (siteIds.length > 0) {
      const { data: thisWeekData } = await service
        .from('page_views')
        .select('id', { count: 'exact', head: true })
        .in('site_id', siteIds)
        .gte('viewed_at', weekAgo);
      thisWeekViews = thisWeekData ? (thisWeekData as unknown as { count: number }).count || 0 : 0;

      const { count: twCount } = await service
        .from('page_views')
        .select('id', { count: 'exact', head: true })
        .in('site_id', siteIds)
        .gte('viewed_at', twoWeeksAgo)
        .lt('viewed_at', weekAgo);
      lastWeekViews = twCount || 0;
    }

    // Fallback: use sum of view_count if page_views table not populated
    if (thisWeekViews === 0 && published.length > 0) {
      thisWeekViews = published.reduce((s, site) => s + (site.view_count || 0), 0);
    }

    // Fetch unread contacts
    const { count: unreadCount } = await service
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .in('site_id', siteIds)
      .eq('read', false);

    const html = buildDigestHtml({
      userName,
      totalViews: thisWeekViews,
      viewChange: thisWeekViews - lastWeekViews,
      unreadContacts: unreadCount || 0,
      publishedSites: published.length,
      unpublishedSites: unpublished.length,
      tipTitle: tip.title,
      tipBody: tip.body,
    });

    const { error } = await resend.emails.send({
      from: 'LARU HP <noreply@laruvisona.jp>',
      to: user.email,
      subject: `【LARU HP】今週のサイトレポート（訪問${thisWeekViews}件）`,
      html,
    });

    if (error) {
      errors.push(`${user.email}: ${error.message}`);
      continue;
    }

    await service.from('profiles').update({ digest_last_sent: now.toISOString() }).eq('id', profile.id);
    sent++;
  }

  return NextResponse.json({ sent, errors });
}
