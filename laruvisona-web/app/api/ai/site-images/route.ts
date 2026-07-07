import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  buildHeroPrompt, galleryScenesFor, buildGalleryPrompt,
  generateImagenToStorage, getAdminStorage,
} from '@/lib/imagen';

// AI生成HP用の画像を返す。
// 基本は事前生成した「業種ライブラリ」(library/<industry>/hero|gallery) からランダムに選ぶだけ
// （生成コスト・待ち時間ゼロ）。ライブラリが未整備の業種のみ、その場で Imagen 生成にフォールバックする。
//
// ライブラリの作り方: 管理者が一度 POST /api/admin/generate-image-library を実行してプールを作る。

const GALLERY_PICK = 4;

function pickRandom<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

async function pickFromLibrary(industry: string): Promise<{ heroImage: string | null; galleryImages: string[] }> {
  const admin = getAdminStorage();
  const pub = (path: string) => admin.storage.from('site-images').getPublicUrl(path).data.publicUrl;

  const [{ data: heroFiles }, { data: galFiles }] = await Promise.all([
    admin.storage.from('site-images').list(`library/${industry}/hero`),
    admin.storage.from('site-images').list(`library/${industry}/gallery`),
  ]);

  const heroList = (heroFiles || []).filter(f => f.name.endsWith('.webp'));
  const galList = (galFiles || []).filter(f => f.name.endsWith('.webp'));

  const heroImage = heroList.length
    ? pub(`library/${industry}/hero/${pickRandom(heroList, 1)[0].name}`)
    : null;
  const galleryImages = galList.length
    ? pickRandom(galList, GALLERY_PICK).map(f => pub(`library/${industry}/gallery/${f.name}`))
    : [];

  return { heroImage, galleryImages };
}

// ライブラリが空の業種向け: その場で最小限生成（ユーザー個別フォルダに保存）
async function generateLive(userId: string, industry: string, businessName: string, description: string) {
  const scenes = galleryScenesFor(industry).slice(0, GALLERY_PICK);
  const [heroImage, ...gallery] = await Promise.all([
    generateImagenToStorage(buildHeroPrompt(industry, businessName, description), '16:9', 1600, 900, `${userId}/hero-${Date.now()}.webp`),
    ...scenes.map((s, i) => generateImagenToStorage(buildGalleryPrompt(s, businessName), '4:3', 1000, 750, `${userId}/gallery-${Date.now()}-${i}.webp`)),
  ]);
  return { heroImage, galleryImages: gallery.filter((u): u is string => !!u) };
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { industry = 'other', businessName = '', description = '' } = await req.json().catch(() => ({}));

  // まずライブラリから（コスト・待ち時間ゼロ）
  let { heroImage, galleryImages } = await pickFromLibrary(industry);

  // ライブラリ未整備の業種のみ、その場生成でフォールバック
  if (!heroImage && galleryImages.length === 0) {
    ({ heroImage, galleryImages } = await generateLive(user.id, industry, businessName, description));
  }

  return NextResponse.json({ heroImage, galleryImages });
}
