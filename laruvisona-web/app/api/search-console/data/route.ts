import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

interface GscRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface GscSiteEntry {
  siteUrl: string;
  permissionLevel: string;
}

async function getAccessToken(refreshToken: string): Promise<string | null> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json() as { access_token?: string };
  return data.access_token ?? null;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = await createServiceClient();
  const { data: profile } = await service
    .from('profiles')
    .select('google_refresh_token, search_console_site_url')
    .eq('id', user.id)
    .single();

  if (!profile?.google_refresh_token) {
    return NextResponse.json({ connected: false });
  }

  const accessToken = await getAccessToken(profile.google_refresh_token);
  if (!accessToken) {
    // Refresh token may be revoked — clear it
    await service.from('profiles').update({ google_refresh_token: null, search_console_site_url: null }).eq('id', user.id);
    return NextResponse.json({ connected: false, revoked: true });
  }

  // Fetch available properties (always returned so settings can show selector)
  const sitesRes = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const sitesData = await sitesRes.json() as { siteEntry?: GscSiteEntry[] };
  const availableSites = (sitesData.siteEntry || []).map(s => s.siteUrl);

  const siteUrl = profile.search_console_site_url as string | null;

  if (!siteUrl) {
    return NextResponse.json({ connected: true, siteUrl: null, availableSites });
  }

  const end = new Date();
  const start = new Date(Date.now() - 28 * 86_400_000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const apiBase = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

  const [summaryRes, datesRes, queriesRes] = await Promise.all([
    fetch(apiBase, {
      method: 'POST',
      headers,
      body: JSON.stringify({ startDate: fmt(start), endDate: fmt(end), dimensions: [] }),
    }),
    fetch(apiBase, {
      method: 'POST',
      headers,
      body: JSON.stringify({ startDate: fmt(start), endDate: fmt(end), dimensions: ['date'], rowLimit: 28 }),
    }),
    fetch(apiBase, {
      method: 'POST',
      headers,
      body: JSON.stringify({ startDate: fmt(start), endDate: fmt(end), dimensions: ['query'], rowLimit: 5 }),
    }),
  ]);

  const [summary, dates, queries] = await Promise.all([
    summaryRes.json() as Promise<{ rows?: GscRow[] }>,
    datesRes.json() as Promise<{ rows?: GscRow[] }>,
    queriesRes.json() as Promise<{ rows?: GscRow[] }>,
  ]);

  const row = summary.rows?.[0];
  return NextResponse.json({
    connected: true,
    siteUrl,
    availableSites,
    summary: {
      clicks: row?.clicks ?? 0,
      impressions: row?.impressions ?? 0,
      ctr: row ? Math.round(row.ctr * 1000) / 10 : 0,
      position: row ? Math.round(row.position * 10) / 10 : 0,
    },
    dates: (dates.rows || []).map(r => ({
      date: r.keys[0],
      clicks: r.clicks,
      impressions: r.impressions,
    })),
    topQueries: (queries.rows || []).map(r => ({
      query: r.keys[0],
      clicks: r.clicks,
      impressions: r.impressions,
      position: Math.round(r.position * 10) / 10,
    })),
  });
}
