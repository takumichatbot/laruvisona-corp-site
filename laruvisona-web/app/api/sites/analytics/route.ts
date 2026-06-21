import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Returns daily views for all user's sites
// Query params: ?days=7 (default) | 30 | all
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const daysParam = searchParams.get('days') || '7';
  const daysCount = daysParam === 'all' ? 180 : Math.min(parseInt(daysParam) || 7, 90);

  // Build date range
  const days: string[] = [];
  if (daysCount) {
    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().split('T')[0]);
    }
  }

  const { data: sites } = await supabase.from('sites').select('id').eq('user_id', user.id);
  const siteIds = (sites || []).map(s => s.id);
  if (!siteIds.length) return NextResponse.json({ data: {}, days });

  let query = supabase
    .from('daily_views')
    .select('site_id, date, views')
    .in('site_id', siteIds)
    .order('date', { ascending: true });

  if (daysCount && days.length > 0) {
    query = query.gte('date', days[0]).lte('date', days[days.length - 1]);
  }

  const { data: rows } = await query;

  // For 'all', build date list from actual data
  const effectiveDays = daysCount
    ? days
    : [...new Set((rows || []).map(r => r.date))].sort();

  // Group by site_id → { date: views }
  const bysite: Record<string, Record<string, number>> = {};
  for (const row of rows || []) {
    if (!bysite[row.site_id]) bysite[row.site_id] = {};
    bysite[row.site_id][row.date] = row.views;
  }

  const result: Record<string, { date: string; views: number }[]> = {};
  for (const id of siteIds) {
    result[id] = effectiveDays.map(date => ({ date, views: bysite[id]?.[date] ?? 0 }));
  }

  return NextResponse.json({ data: result, days: effectiveDays });
}
