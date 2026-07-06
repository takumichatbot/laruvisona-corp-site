import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import sharp from 'sharp';

// AI生成HP用の画像を1回でまとめて用意する。
//   hero    … Google Imagen 4.0 で「その店だけ」の専用画像を生成し Supabase Storage に保存 → 公開URL
//   gallery … Unsplash を業種＋キーワードで検索した実写を複数枚
// すべてベストエフォート。生成/検索が失敗しても例外は投げず、取れたものだけ返す
// （ヒーローが生成できなければ Unsplash 実写にフォールバックし、必ず1枚は返す）。

const INDUSTRY_QUERY: Record<string, string> = {
  restaurant: 'restaurant interior japanese cuisine',
  beauty: 'beauty salon hair styling interior',
  clinic: 'physiotherapy clinic treatment room',
  legal: 'law office professional consultation',
  construction: 'construction craftsmanship building site',
  realestate: 'modern house interior real estate',
  retail: 'boutique retail store interior',
  fitness: 'modern gym fitness studio',
  hotel: 'hotel lobby luxury interior',
  education: 'classroom school learning',
  wedding: 'wedding ceremony elegant venue',
  pet: 'pet grooming salon dog',
  dental: 'dental clinic modern interior',
  photo: 'photography studio lighting',
  accounting: 'professional office business meeting',
  other: 'professional business office',
};

const IMAGEN_STYLE: Record<string, string> = {
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

// Unsplash 未設定時のフォールバック（業種で少しでも変わるよう、汎用ビジネス写真をずらして返す）
const UNSPLASH_FALLBACK = [
  'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80',
  'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&q=80',
  'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1200&q=80',
  'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=1200&q=80',
  'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&q=80',
  'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1200&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1200&q=80',
  'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1200&q=80',
];

async function fetchUnsplash(query: string, count: number): Promise<string[]> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) {
    // キー未設定: 汎用写真をシャッフル的にずらして返す（毎回同じ並びを避ける）
    const offset = Math.floor(Math.random() * UNSPLASH_FALLBACK.length);
    return Array.from({ length: count }, (_, i) => UNSPLASH_FALLBACK[(offset + i) % UNSPLASH_FALLBACK.length]);
  }
  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${Math.min(20, count + 6)}&orientation=landscape`,
      { headers: { Authorization: `Client-ID ${key}` } },
    );
    if (!res.ok) throw new Error(`unsplash ${res.status}`);
    const data = await res.json() as { results?: { urls: { regular: string } }[] };
    const urls = (data.results || []).map(p => p.urls.regular);
    if (!urls.length) throw new Error('no results');
    // 先頭に寄りすぎないよう軽くシャッフル
    return urls.sort(() => Math.random() - 0.5).slice(0, count);
  } catch {
    const offset = Math.floor(Math.random() * UNSPLASH_FALLBACK.length);
    return Array.from({ length: count }, (_, i) => UNSPLASH_FALLBACK[(offset + i) % UNSPLASH_FALLBACK.length]);
  }
}

async function generateHeroWithImagen(userId: string, industry: string, businessName: string, description: string): Promise<string | null> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) return null;

  const style = IMAGEN_STYLE[industry] || IMAGEN_STYLE.other;
  const desc = (description || '').slice(0, 200);
  const prompt = `Professional website hero background photo for a Japanese local business "${businessName}". ${style}. ${desc}. Photorealistic, high quality, cinematic, wide 16:9 composition, no text, no letters, no watermark, no people looking at camera.`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000); // 25秒でタイムアウト → フォールバックへ
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instances: [{ prompt }], parameters: { sampleCount: 1, aspectRatio: '16:9' } }),
        signal: controller.signal,
      },
    );
    if (!res.ok) return null;
    const data = await res.json() as { predictions?: { bytesBase64Encoded: string }[] };
    const b64 = data.predictions?.[0]?.bytesBase64Encoded;
    if (!b64) return null;

    // base64 をそのまま公開HTMLに埋めると重いので WebP 化して Storage に保存し URL 参照にする
    const webp = await sharp(Buffer.from(b64, 'base64'))
      .resize({ width: 1600, height: 900, fit: 'cover' })
      .webp({ quality: 82 })
      .toBuffer();

    const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const path = `${userId}/hero-${Date.now()}.webp`;
    const { error } = await admin.storage.from('site-images').upload(path, webp, { contentType: 'image/webp', upsert: false });
    if (error) return null;
    return admin.storage.from('site-images').getPublicUrl(path).data.publicUrl;
  } catch {
    return null; // タイムアウト・生成失敗 → 呼び出し側で Unsplash にフォールバック
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { industry = 'other', businessName = '', description = '', keywords = '' } = await req.json().catch(() => ({}));
  const baseQuery = INDUSTRY_QUERY[industry] || INDUSTRY_QUERY.other;
  const galleryQuery = keywords ? `${baseQuery} ${String(keywords).split(',')[0]}` : baseQuery;

  // ヒーロー生成（Imagen）とギャラリー（Unsplash）を並行取得
  const [heroGenerated, gallery] = await Promise.all([
    generateHeroWithImagen(user.id, industry, businessName, description),
    fetchUnsplash(galleryQuery, 4),
  ]);

  // ヒーローが生成できなければ Unsplash 実写を1枚ヒーローに回す（必ず1枚は返す）
  let heroImage = heroGenerated;
  let galleryImages = gallery;
  if (!heroImage) {
    const heroFallback = await fetchUnsplash(baseQuery, 1);
    heroImage = heroFallback[0] || gallery[0] || null;
  }

  return NextResponse.json({
    heroImage,
    galleryImages,
    heroSource: heroGenerated ? 'imagen' : 'unsplash', // デバッグ・分析用
  });
}
