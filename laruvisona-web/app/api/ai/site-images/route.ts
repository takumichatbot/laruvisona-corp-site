import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import sharp from 'sharp';

// AI生成HP用の画像を Google Imagen 4.0 だけで用意する（サードパーティAPIキー不要）。
//   hero    … 「その店だけ」の専用ヒーロー画像（16:9）
//   gallery … 業種に合わせた別アングルの画像を複数枚（4:3）
// ヒーローとギャラリーを1回ずつ prompt を変えて並行生成し、Supabase Storage に保存して
// 公開URLを返す。すべてベストエフォート：生成できたものだけ返し、失敗しても例外は投げない。
//
// コスト注記: 1サイトあたり Imagen を (1 + GALLERY_COUNT) 枚生成する。
// コストを抑えたい場合は GALLERY_COUNT を下げる（0でヒーローのみ）。
const GALLERY_COUNT = 4;

// ヒーロー用の世界観（業種別）
const HERO_STYLE: Record<string, string> = {
  restaurant: 'warm inviting restaurant interior, soft ambient lighting, beautifully plated cuisine',
  beauty: 'elegant modern hair salon interior, clean bright, stylish mirrors and chairs',
  clinic: 'calm clean therapy clinic room, natural light, professional and reassuring',
  legal: 'sophisticated law office, bookshelves, warm professional atmosphere',
  construction: 'skilled craftsmanship, modern building exterior, blue sky',
  realestate: 'bright modern living room interior, large windows, tasteful furniture',
  retail: 'stylish boutique storefront interior, curated product display',
  fitness: 'modern fitness gym, natural light, clean equipment',
  hotel: 'luxurious hotel lobby, warm elegant lighting, refined interior',
  education: 'bright welcoming classroom, natural light, inspiring learning space',
  wedding: 'elegant wedding venue, soft romantic lighting, floral decor',
  pet: 'cheerful pet grooming salon, bright and friendly',
  dental: 'clean modern dental clinic interior, calm and bright',
  photo: 'professional photography studio, dramatic soft lighting',
  accounting: 'clean professional office, natural light, trustworthy atmosphere',
  other: 'clean professional business environment, natural light',
};

// ギャラリー用の別アングル（業種別に主題を変えて似た絵にならないようにする）
const GALLERY_SCENES: Record<string, string[]> = {
  restaurant: ['signature dish beautifully plated close-up', 'cozy dining interior with warm lighting', 'fresh seasonal ingredients on a wooden table', 'barista or chef preparing food'],
  beauty: ['stylish salon styling chair and mirror', 'close-up of elegant hair styling result', 'shelf of premium hair care products', 'relaxing shampoo station'],
  clinic: ['clean treatment room with bed', 'therapist adjusting posture professionally', 'reception area calm and welcoming', 'close-up of hands performing gentle therapy'],
  legal: ['professional consultation across a desk', 'law bookshelf and documents', 'modern meeting room', 'handshake in an office'],
  construction: ['modern completed building exterior', 'craftsman working with tools', 'architectural detail close-up', 'construction team on site'],
  realestate: ['bright modern kitchen interior', 'spacious living room with natural light', 'modern house exterior with garden', 'elegant bedroom interior'],
  retail: ['curated product display on shelves', 'stylish shop interior', 'close-up of featured products', 'shopping bags and counter'],
  fitness: ['person training with dumbbells', 'modern gym equipment row', 'group fitness studio', 'close-up of workout in motion'],
  hotel: ['elegant hotel guest room', 'luxurious bathroom interior', 'hotel restaurant or lounge', 'welcoming reception desk'],
  education: ['students engaged in a bright classroom', 'study desk with books and laptop', 'teacher guiding a lesson', 'modern school building'],
  wedding: ['elegant wedding reception table setting', 'bridal bouquet close-up', 'romantic ceremony arch with flowers', 'couple silhouette at golden hour'],
  pet: ['happy dog being groomed', 'clean pet grooming station', 'cute pet after grooming', 'grooming tools neatly arranged'],
  dental: ['modern dental treatment chair', 'friendly dentist with patient', 'clean bright reception', 'close-up of dental care tools'],
  photo: ['professional studio lighting setup', 'photographer at work', 'elegant portrait result', 'camera and lens close-up'],
  accounting: ['professional reviewing documents', 'modern office desk with laptop', 'business meeting discussion', 'calculator and financial charts'],
  other: ['modern professional office interior', 'team collaborating at a desk', 'close-up of professional work', 'welcoming reception area'],
};

function getAdminStorage() {
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Imagen で1枚生成 → WebP化 → Storage保存 → 公開URL。失敗時は null（例外を投げない）。
async function generateImagenToStorage(
  userId: string,
  prompt: string,
  aspectRatio: '16:9' | '4:3',
  targetW: number,
  targetH: number,
  label: string,
): Promise<string | null> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000); // 30秒でタイムアウト
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instances: [{ prompt }], parameters: { sampleCount: 1, aspectRatio } }),
        signal: controller.signal,
      },
    );
    if (!res.ok) return null;
    const data = await res.json() as { predictions?: { bytesBase64Encoded: string }[] };
    const b64 = data.predictions?.[0]?.bytesBase64Encoded;
    if (!b64) return null;

    // base64 をそのまま公開HTMLに埋めると重いので WebP 化して Storage に保存し URL 参照にする
    const webp = await sharp(Buffer.from(b64, 'base64'))
      .resize({ width: targetW, height: targetH, fit: 'cover' })
      .webp({ quality: 82 })
      .toBuffer();

    const admin = getAdminStorage();
    const path = `${userId}/${label}-${Date.now()}-${Math.round(Math.random() * 1e6)}.webp`;
    const { error } = await admin.storage.from('site-images').upload(path, webp, { contentType: 'image/webp', upsert: false });
    if (error) return null;
    return admin.storage.from('site-images').getPublicUrl(path).data.publicUrl;
  } catch {
    return null; // タイムアウト・生成失敗
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { industry = 'other', businessName = '', description = '' } = await req.json().catch(() => ({}));

  const heroStyle = HERO_STYLE[industry] || HERO_STYLE.other;
  const scenes = GALLERY_SCENES[industry] || GALLERY_SCENES.other;
  const desc = String(description || '').slice(0, 200);
  const brand = businessName ? ` for a Japanese local business "${businessName}"` : '';

  const heroPrompt = `Professional website hero background photo${brand}. ${heroStyle}. ${desc}. Photorealistic, high quality, cinematic, wide 16:9 composition, no text, no letters, no watermark.`;

  const galleryPrompts = scenes.slice(0, GALLERY_COUNT).map(scene =>
    `Professional website photo${brand}: ${scene}. Photorealistic, high quality, natural light, no text, no letters, no watermark.`,
  );

  // ヒーロー + ギャラリーを全部並行生成（wall-clock はほぼ最遅1枚ぶん）
  const [heroImage, ...galleryResults] = await Promise.all([
    generateImagenToStorage(user.id, heroPrompt, '16:9', 1600, 900, 'hero'),
    ...galleryPrompts.map((p, i) => generateImagenToStorage(user.id, p, '4:3', 1000, 750, `gallery${i}`)),
  ]);

  const galleryImages = galleryResults.filter((u): u is string => !!u);

  return NextResponse.json({ heroImage, galleryImages });
}
