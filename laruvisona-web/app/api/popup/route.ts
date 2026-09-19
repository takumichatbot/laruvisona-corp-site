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
  /*
    閲覧パスワードを掛けたサイトの文面を、ここから取らせない。
    proxy の門は /hp/... には掛かるが /api は素通りするので、
    2026-09-19まで `GET /api/popup?slug=` で門の内側の文面が読めた。
    ページ本体は門で止まっているので、ここも同じ扱いにする。
    （合っている人にだけ出すには合言葉の照合が要るが、ポップアップの
      ために鍵を渡り歩かせる価値は無い。保護中は出さない、で足りる。）
  */
  if (typeof settings.sitePassword === 'string' && settings.sitePassword.trim()) {
    return javascript('// Protected site', 200);
  }
  const source = Array.isArray(settings.popups) ? settings.popups : [];
  const popups = source.map(sanitizePopup).filter(p => p !== null).slice(0, 20);
  if (!popups.length) return javascript('// No active popups');
  return javascript(popupScript(result.data.id, popups));
}
