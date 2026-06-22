import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';

// POST /api/heatmap — collect click/scroll events from published sites (no auth needed, uses site token)
// GET  /api/heatmap?siteId=xxx — return aggregated heatmap data (requires auth)

interface HeatmapEvent {
  type: 'click' | 'scroll';
  x?: number;
  y?: number;
  scrollDepth?: number;
  path: string;
  viewport: { w: number; h: number };
}

export async function POST(req: Request) {
  // Public endpoint — published sites post events here
  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get('siteId');
  const slug = searchParams.get('slug');

  if (!siteId && !slug) return NextResponse.json({ error: 'siteId or slug required' }, { status: 400 });

  let events: HeatmapEvent[] = [];
  try {
    events = await req.json() as HeatmapEvent[];
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  if (!Array.isArray(events) || events.length === 0) {
    return NextResponse.json({ ok: true });
  }

  const service = await createServiceClient();

  // Resolve siteId from slug if needed
  let resolvedSiteId = siteId;
  if (!resolvedSiteId && slug) {
    const { data: site } = await service.from('sites').select('id').eq('slug', slug).single();
    resolvedSiteId = site?.id ?? null;
  }

  if (!resolvedSiteId) return NextResponse.json({ ok: true }); // silently ignore

  const rows = events
    .filter((e) => e.type === 'click' || e.type === 'scroll')
    .slice(0, 50) // max 50 events per batch
    .map((e) => ({
      site_id: resolvedSiteId,
      event_type: e.type,
      x: e.x ?? null,
      y: e.y ?? null,
      scroll_depth: e.scrollDepth ?? null,
      path: e.path?.slice(0, 255) ?? '/',
      viewport_w: e.viewport?.w ?? 0,
      viewport_h: e.viewport?.h ?? 0,
      created_at: new Date().toISOString(),
    }));

  await service.from('heatmap_events').insert(rows);

  return NextResponse.json({ ok: true });
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get('siteId');
  const path = searchParams.get('path') || '/';
  const type = searchParams.get('type') || 'click';

  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  // Verify ownership
  const { data: site } = await supabase.from('sites').select('id, slug').eq('id', siteId).eq('user_id', user.id).single();
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  const service = await createServiceClient();

  // Get last 30 days of events
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: events } = await service
    .from('heatmap_events')
    .select('event_type, x, y, scroll_depth, viewport_w, viewport_h')
    .eq('site_id', siteId)
    .eq('path', path)
    .eq('event_type', type)
    .gte('created_at', since)
    .limit(2000);

  // Aggregate clicks into a grid (normalize by viewport)
  if (type === 'click') {
    const points = (events || [])
      .filter((e) => e.x !== null && e.y !== null)
      .map((e) => ({
        // Normalize to percentage of viewport
        x: Math.round(((e.x ?? 0) / (e.viewport_w || 1)) * 100),
        y: Math.round(((e.y ?? 0) / (e.viewport_h || 1)) * 100),
      }));

    // Bucket into grid cells
    const grid: Record<string, number> = {};
    for (const p of points) {
      const key = `${Math.floor(p.x / 2) * 2},${Math.floor(p.y / 2) * 2}`;
      grid[key] = (grid[key] || 0) + 1;
    }

    return NextResponse.json({ type: 'click', points, grid, total: points.length });
  }

  // Scroll depth histogram
  const depths = (events || [])
    .filter((e) => e.scroll_depth !== null)
    .map((e) => e.scroll_depth ?? 0);

  const histogram = [0, 25, 50, 75, 100].map((threshold) => ({
    depth: threshold,
    count: depths.filter((d) => d >= threshold).length,
    pct: depths.length > 0 ? Math.round((depths.filter((d) => d >= threshold).length / depths.length) * 100) : 0,
  }));

  return NextResponse.json({ type: 'scroll', histogram, total: depths.length });
}
