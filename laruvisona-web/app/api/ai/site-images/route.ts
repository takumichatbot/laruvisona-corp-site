import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getAdminStorage,
} from '@/lib/imagen';
import { readAiJson, requireAiAccess } from '@/lib/ai-access';

// AI生成HP用の画像を返す。
// 基本は事前生成した「業種ライブラリ」(library/<industry>/hero|gallery) からランダムに選ぶだけ
// （生成コスト・待ち時間ゼロ）。未整備時は空で返し、利用者ごとの自動生成は行わない。
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

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied=await requireAiAccess(supabase,user.id,'asset-library',60);
  if(denied)return denied;
  const parsed=await readAiJson(req,64_000);
  if(!parsed.ok)return parsed.response;

  const { industry = 'other' } = parsed.data as { industry?: string };
  if (typeof industry !== 'string' || industry.length > 80) return NextResponse.json({ error: '業種を確認してください' }, { status: 400 });

  // まずライブラリから（コスト・待ち時間ゼロ）
  const { heroImage, galleryImages } = await pickFromLibrary(industry);

  return NextResponse.json({ heroImage, galleryImages });
}
