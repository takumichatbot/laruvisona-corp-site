import { NextResponse } from 'next/server';
import {
  IMAGE_INDUSTRIES, buildHeroPrompt, galleryScenesFor, buildGalleryPrompt,
  generateImagenToStorage, getAdminStorage, getGeminiKey,
} from '@/lib/imagen';

// ライブラリ画像を返す公開エンドポイント（セルフヒーリング）。
// 生成済みならストレージの公開URLへリダイレクト。未生成ならその場で1枚だけ
// Imagen生成してからリダイレクトする。LPや業種ページが参照するだけで
// プールが自動的に埋まっていくため、管理画面での一括生成は不要になる。
//
// 乱用対策: 生成対象は固定プール（業種 × hero3 + gallery6）に限定しており、
// 一度生成されたパスは再生成されないため、総生成枚数は有限。
const HERO_MAX = 3;
const GALLERY_MAX = 6;

// 同じ画像への同時リクエストを1つの生成にまとめる（Renderは常駐プロセスなので有効）
const inflight = new Map<string, Promise<string | null>>();

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

  if (!getGeminiKey()) return new NextResponse(null, { status: 404 });

  let p = inflight.get(path);
  if (!p) {
    const scenes = galleryScenesFor(industry);
    p = (kind === 'hero'
      ? generateImagenToStorage(buildHeroPrompt(industry), '16:9', 1600, 900, path)
      : generateImagenToStorage(buildGalleryPrompt(scenes[n % scenes.length]), '4:3', 1000, 750, path)
    ).finally(() => inflight.delete(path));
    inflight.set(path, p);
  }
  const generated = await p;
  // 生成失敗（レート制限等）は404。クライアント側は絵文字フォールバックし、次回アクセスで再試行される
  if (!generated) return new NextResponse(null, { status: 404 });
  return redirect();
}
