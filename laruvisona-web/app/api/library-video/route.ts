import { NextResponse } from 'next/server';
import { IMAGE_INDUSTRIES, getAdminStorage } from '@/lib/imagen';
import { videoStoragePath } from '@/lib/veo';

// 業種ショーケース用のループ動画を返す公開エンドポイント。
// 画像側と違い、ここでは生成しない（動画は遅く高いため）。
// 未生成なら404を返し、呼び出し側は静止画のまま表示を続ける。

export async function GET(req: Request) {
  const industry = new URL(req.url).searchParams.get('industry') || '';
  if (!(IMAGE_INDUSTRIES as readonly string[]).includes(industry)) {
    return new NextResponse(null, { status: 404 });
  }

  const admin = getAdminStorage();
  const { data: files } = await admin.storage.from('site-images').list('videos');
  if (!(files || []).some(f => f.name === `${industry}.mp4`)) {
    return new NextResponse(null, { status: 404 });
  }

  const pub = admin.storage.from('site-images').getPublicUrl(videoStoragePath(industry)).data.publicUrl;
  return NextResponse.redirect(pub, { status: 302, headers: { 'Cache-Control': 'public, max-age=86400' } });
}
