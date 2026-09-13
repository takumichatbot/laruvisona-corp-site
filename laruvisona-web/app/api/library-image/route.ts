import { NextResponse } from 'next/server';
import { IMAGE_INDUSTRIES, getAdminStorage } from '@/lib/imagen';

// Public delivery for assets already prepared by an authenticated administrator.
// A missing file stays missing: an unauthenticated GET must never incur AI cost.
const HERO_MAX = 3;
const GALLERY_MAX = 6;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const industry = url.searchParams.get('industry') || '';
  const kind = url.searchParams.get('kind') || '';
  const n = parseInt(url.searchParams.get('n') || '', 10);

  if (!(IMAGE_INDUSTRIES as readonly string[]).includes(industry)) return new NextResponse(null, { status: 404 });
  if (kind !== 'hero' && kind !== 'gallery') return new NextResponse(null, { status: 404 });
  const max = kind === 'hero' ? HERO_MAX : GALLERY_MAX;
  if (!Number.isInteger(n) || n < 0 || n >= max) return new NextResponse(null, { status: 404 });

  const path = `library/${industry}/${kind}/${n}.webp`;
  const admin = getAdminStorage();
  const pub = admin.storage.from('site-images').getPublicUrl(path).data.publicUrl;
  const redirect = () => NextResponse.redirect(pub, { status: 302, headers: { 'Cache-Control': 'public, max-age=86400' } });

  const { data: files } = await admin.storage.from('site-images').list(`library/${industry}/${kind}`);
  if ((files || []).some(f => f.name === `${n}.webp`)) return redirect();

  return new NextResponse(null, { status: 404, headers: { 'Cache-Control': 'public, max-age=300' } });
}
