import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { popupScript, sanitizePopup } from '@/lib/popup-contract';

const javascript = (body: string, status = 200) => new NextResponse(body, {
  status,
  headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=60' },
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug');
  const siteId = searchParams.get('siteId');
  if (!slug && !siteId) return javascript('// No site', 400);

  const service = createServiceClient();
  let query = service.from('sites').select('id,settings_json').eq('published', true);
  query = siteId ? query.eq('id', siteId) : query.eq('slug', slug!);
  const result = await query.maybeSingle();
  if (result.error) return javascript('// Temporarily unavailable', 503);
  if (!result.data) return javascript('// Site not found', 404);

  const settings = result.data.settings_json && typeof result.data.settings_json === 'object'
    ? result.data.settings_json as Record<string, unknown> : {};
  const source = Array.isArray(settings.popups) ? settings.popups : [];
  const popups = source.map(sanitizePopup).filter(p => p !== null).slice(0, 20);
  if (!popups.length) return javascript('// No active popups');
  return javascript(popupScript(result.data.id, popups));
}
