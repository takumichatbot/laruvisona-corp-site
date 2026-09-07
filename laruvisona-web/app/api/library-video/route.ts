import { NextResponse } from 'next/server';
import { IMAGE_INDUSTRIES, getAdminStorage } from '@/lib/imagen';
import { HERO_VIDEO_PATH, videoStoragePath } from '@/lib/veo-prompt';

// 業種ショーケース用のループ動画を返す公開エンドポイント。
// 画像側と違い、ここでは生成しない（動画は遅く高いため）。
// 未生成なら404を返し、呼び出し側は静止画のまま表示を続ける。

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const target = sp.get('target');
  const industry = sp.get('industry') || '';

  // LPのファーストビュー用の1本 か、業種ショーケース用か
  const path = target === 'lp-hero'
    ? HERO_VIDEO_PATH
    : (IMAGE_INDUSTRIES as readonly string[]).includes(industry) ? videoStoragePath(industry) : null;
  if (!path) return new NextResponse(null, { status: 404 });

  const fileName = path.split('/').pop();
  const admin = getAdminStorage();
  const { data: files } = await admin.storage.from('site-images').list('videos');
  if (!(files || []).some(f => f.name === fileName)) {
    return new NextResponse(null, { status: 404 });
  }

  const pub = admin.storage.from('site-images').getPublicUrl(path).data.publicUrl;
  return NextResponse.redirect(pub, { status: 302, headers: { 'Cache-Control': 'public, max-age=86400' } });
}
