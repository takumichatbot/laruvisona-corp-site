import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

// GET /api/cron/weekly-report
// Called weekly by Render Cron or cron-job.org.
// Requires header: Authorization: Bearer CRON_SECRET
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization') ?? '';
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const resend = new Resend(process.env.RESEND_API_KEY);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://laruvisona.jp';

  // Get all active subscribers
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, plan')
    .eq('subscription_status', 'active')
    .not('plan', 'is', null);

  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ sent: 0, message: 'No active profiles' });
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const prevWeekStart = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  let sent = 0;
  let errors = 0;

  for (const profile of profiles) {
    try {
      // Get user email
      const { data: { user } } = await supabase.auth.admin.getUserById(profile.id);
      if (!user?.email) continue;

      // Get all sites
      const { data: sites } = await supabase
        .from('sites')
        .select('id, name, slug, published, view_count')
        .eq('user_id', profile.id)
        .order('view_count', { ascending: false });

      if (!sites || sites.length === 0) continue;

      const siteIds = sites.map(s => s.id);

      // This week PV
      const { data: thisWeekViews } = await supabase
        .from('daily_views')
        .select('views')
        .in('site_id', siteIds)
        .gte('date', sevenDaysAgo);

      const thisWeekPv = (thisWeekViews || []).reduce((s, r) => s + (r.views || 0), 0);

      // Previous week PV
      const { data: prevWeekViews } = await supabase
        .from('daily_views')
        .select('views')
        .in('site_id', siteIds)
        .gte('date', prevWeekStart)
        .lt('date', sevenDaysAgo);

      const prevWeekPv = (prevWeekViews || []).reduce((s, r) => s + (r.views || 0), 0);

      // This week contacts
      const { count: thisWeekContacts } = await supabase
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .in('site_id', siteIds)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      const pvChange = prevWeekPv > 0
        ? Math.round(((thisWeekPv - prevWeekPv) / prevWeekPv) * 100)
        : thisWeekPv > 0 ? 100 : 0;

      const pvTrend = pvChange > 0 ? `+${pvChange}%` : pvChange < 0 ? `${pvChange}%` : '±0%';
      const pvTrendColor = pvChange > 0 ? '#16a34a' : pvChange < 0 ? '#dc2626' : '#64748b';

      const publishedSites = sites.filter(s => s.published);

      // Top 3 sites by total views
      const topSites = sites
        .filter(s => s.published && s.slug)
        .slice(0, 3);

      const topSitesHtml = topSites.length > 0
        ? topSites.map(s => `
            <tr>
              <td style="padding:8px 12px;font-size:13px;color:#374151;border-bottom:1px solid #f1f5f9">${s.name}</td>
              <td style="padding:8px 12px;font-size:13px;font-weight:700;color:#0369a1;text-align:right;border-bottom:1px solid #f1f5f9">${(s.view_count || 0).toLocaleString()}PV</td>
            </tr>
          `).join('')
        : '<tr><td colspan="2" style="padding:12px;text-align:center;color:#94a3b8;font-size:12px">データなし</td></tr>';

      await resend.emails.send({
        from: 'LARU HP <noreply@laruvisona.jp>',
        to: user.email,
        subject: `【週次レポート】先週のアクセス: ${thisWeekPv.toLocaleString()}PV`,
        html: `
<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f9ff;font-family:'Helvetica Neue',Arial,'Hiragino Sans','Yu Gothic',sans-serif">
  <div style="max-width:560px;margin:40px auto 20px;padding:0 16px">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0369a1,#0ea5e9);border-radius:16px 16px 0 0;padding:32px 36px">
      <div style="font-size:14px;font-weight:900;color:rgba(255,255,255,0.9);letter-spacing:-0.5px;margin-bottom:20px">LARU<span style="font-weight:300">HP</span></div>
      <div style="color:rgba(255,255,255,0.7);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px">週次レポート</div>
      <h1 style="color:white;font-size:24px;font-weight:800;margin:0;line-height:1.3">先週のまとめ</h1>
    </div>

    <!-- Stats row -->
    <div style="background:#fff;border-left:1px solid #e0f2fe;border-right:1px solid #e0f2fe;padding:28px 36px">
      <div style="display:flex;gap:16px;margin-bottom:24px">

        <!-- PV card -->
        <div style="flex:1;background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:18px 20px">
          <div style="color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px">ページビュー</div>
          <div style="color:#0369a1;font-size:28px;font-weight:900;line-height:1;margin-bottom:4px">${thisWeekPv.toLocaleString()}</div>
          <div style="color:${pvTrendColor};font-size:12px;font-weight:700">先週比 ${pvTrend}</div>
        </div>

        <!-- Contact card -->
        <div style="flex:1;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:18px 20px">
          <div style="color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px">お問い合わせ</div>
          <div style="color:#16a34a;font-size:28px;font-weight:900;line-height:1;margin-bottom:4px">${(thisWeekContacts || 0).toLocaleString()}</div>
          <div style="color:#64748b;font-size:12px">件 この1週間</div>
        </div>

      </div>

      <div style="color:#374151;font-size:13px;margin-bottom:4px">
        公開中サイト: <strong style="color:#0369a1">${publishedSites.length}件</strong>
        <span style="color:#94a3b8;margin:0 8px">·</span>
        合計サイト: <strong>${sites.length}件</strong>
      </div>

      <!-- Top sites table -->
      ${topSites.length > 0 ? `
      <div style="margin-top:20px">
        <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px">サイト別 累計PV</div>
        <table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:10px;overflow:hidden">
          <tbody>${topSitesHtml}</tbody>
        </table>
      </div>` : ''}

    </div>

    <!-- CTA -->
    <div style="background:#fff;border-left:1px solid #e0f2fe;border-right:1px solid #e0f2fe;border-bottom:1px solid #e0f2fe;border-radius:0 0 16px 16px;padding:0 36px 32px">
      <a href="${appUrl}/laruHP/dashboard" style="display:block;text-align:center;background:linear-gradient(135deg,#0369a1,#0ea5e9);color:white;font-weight:800;font-size:14px;text-decoration:none;padding:15px 24px;border-radius:12px;margin-bottom:16px">
        ダッシュボードで詳細を確認 →
      </a>
      <div style="display:flex;gap:10px">
        <a href="${appUrl}/laruHP/analytics" style="flex:1;text-align:center;background:#f8fafc;border:1px solid #e2e8f0;color:#374151;font-weight:600;font-size:12px;text-decoration:none;padding:10px;border-radius:8px">📊 BI分析</a>
        <a href="${appUrl}/laruHP/heatmap" style="flex:1;text-align:center;background:#f8fafc;border:1px solid #e2e8f0;color:#374151;font-weight:600;font-size:12px;text-decoration:none;padding:10px;border-radius:8px">🔥 ヒートマップ</a>
        <a href="${appUrl}/laruHP/contacts" style="flex:1;text-align:center;background:#f8fafc;border:1px solid #e2e8f0;color:#374151;font-weight:600;font-size:12px;text-decoration:none;padding:10px;border-radius:8px">💬 問い合わせ</a>
      </div>
    </div>

    <p style="text-align:center;color:#94a3b8;font-size:11px;margin-top:20px">
      LARU HP の週次レポートです。配信停止は
      <a href="${appUrl}/laruHP/settings" style="color:#0ea5e9;text-decoration:none">設定</a>
      から行えます。
    </p>
  </div>
</body></html>`,
      });

      sent++;
    } catch {
      errors++;
    }
  }

  return NextResponse.json({ sent, errors, total: profiles.length });
}
