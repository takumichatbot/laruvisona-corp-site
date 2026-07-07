import { createClient as createAdminClient } from '@supabase/supabase-js';
import sharp from 'sharp';

// Google Imagen 4.0 での画像生成＋Supabase Storage保存の共通ロジック。
// 業種ライブラリの事前生成（/api/admin/generate-image-library）と、
// ライブラリ未整備時のフォールバック生成（/api/ai/site-images）の両方から使う。

export const IMAGE_INDUSTRIES = [
  'restaurant', 'beauty', 'clinic', 'legal', 'construction', 'realestate',
  'retail', 'fitness', 'hotel', 'education', 'wedding', 'pet',
  'dental', 'photo', 'accounting', 'other',
] as const;

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
  restaurant: ['signature dish beautifully plated close-up', 'cozy dining interior with warm lighting', 'fresh seasonal ingredients on a wooden table', 'barista or chef preparing food', 'elegant table setting for two', 'dessert and coffee close-up'],
  beauty: ['stylish salon styling chair and mirror', 'close-up of elegant hair styling result', 'shelf of premium hair care products', 'relaxing shampoo station', 'salon reception and waiting area', 'stylist working on a client'],
  clinic: ['clean treatment room with bed', 'therapist adjusting posture professionally', 'reception area calm and welcoming', 'close-up of hands performing gentle therapy', 'anatomical model on a desk', 'bright waiting room'],
  legal: ['professional consultation across a desk', 'law bookshelf and documents', 'modern meeting room', 'handshake in an office', 'gavel and legal documents', 'city view from an office window'],
  construction: ['modern completed building exterior', 'craftsman working with tools', 'architectural detail close-up', 'construction team on site', 'blueprint and hard hat on a table', 'renovated interior space'],
  realestate: ['bright modern kitchen interior', 'spacious living room with natural light', 'modern house exterior with garden', 'elegant bedroom interior', 'stylish bathroom', 'apartment building facade'],
  retail: ['curated product display on shelves', 'stylish shop interior', 'close-up of featured products', 'shopping bags and counter', 'window display', 'boutique fitting area'],
  fitness: ['person training with dumbbells', 'modern gym equipment row', 'group fitness studio', 'close-up of workout in motion', 'yoga studio with natural light', 'personal trainer coaching'],
  hotel: ['elegant hotel guest room', 'luxurious bathroom interior', 'hotel restaurant or lounge', 'welcoming reception desk', 'hotel exterior at dusk', 'spa and relaxation area'],
  education: ['students engaged in a bright classroom', 'study desk with books and laptop', 'teacher guiding a lesson', 'modern school building', 'library reading area', 'science lab equipment'],
  wedding: ['elegant wedding reception table setting', 'bridal bouquet close-up', 'romantic ceremony arch with flowers', 'couple silhouette at golden hour', 'wedding cake close-up', 'decorated venue interior'],
  pet: ['happy dog being groomed', 'clean pet grooming station', 'cute pet after grooming', 'grooming tools neatly arranged', 'playful cat', 'pet salon reception'],
  dental: ['modern dental treatment chair', 'friendly dentist with patient', 'clean bright reception', 'close-up of dental care tools', 'dental x-ray on a screen', 'comfortable waiting room'],
  photo: ['professional studio lighting setup', 'photographer at work', 'elegant portrait result', 'camera and lens close-up', 'backdrop and props', 'editing workstation'],
  accounting: ['professional reviewing documents', 'modern office desk with laptop', 'business meeting discussion', 'calculator and financial charts', 'handshake closing a deal', 'organized filing and paperwork'],
  other: ['modern professional office interior', 'team collaborating at a desk', 'close-up of professional work', 'welcoming reception area', 'business meeting', 'city office building'],
};

export function getGeminiKey(): string | undefined {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
}

export function buildHeroPrompt(industry: string, businessName = '', description = ''): string {
  const style = HERO_STYLE[industry] || HERO_STYLE.other;
  const desc = String(description || '').slice(0, 200);
  const brand = businessName ? ` for a Japanese local business "${businessName}"` : '';
  return `Professional website hero background photo${brand}. ${style}. ${desc}. Photorealistic, high quality, cinematic, wide 16:9 composition, no text, no letters, no watermark.`;
}

export function galleryScenesFor(industry: string): string[] {
  return GALLERY_SCENES[industry] || GALLERY_SCENES.other;
}

export function buildGalleryPrompt(scene: string, businessName = ''): string {
  const brand = businessName ? ` for a Japanese local business "${businessName}"` : '';
  return `Professional website photo${brand}: ${scene}. Photorealistic, high quality, natural light, no text, no letters, no watermark.`;
}

export function getAdminStorage() {
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Imagen で1枚生成 → WebP化 → 指定パスに保存 → 公開URL。失敗時は null（例外を投げない）。
export async function generateImagenToStorage(
  prompt: string,
  aspectRatio: '16:9' | '4:3',
  targetW: number,
  targetH: number,
  storagePath: string,
): Promise<string | null> {
  const apiKey = getGeminiKey();
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

    const webp = await sharp(Buffer.from(b64, 'base64'))
      .resize({ width: targetW, height: targetH, fit: 'cover' })
      .webp({ quality: 82 })
      .toBuffer();

    const admin = getAdminStorage();
    const { error } = await admin.storage.from('site-images').upload(storagePath, webp, { contentType: 'image/webp', upsert: true });
    if (error) return null;
    return admin.storage.from('site-images').getPublicUrl(storagePath).data.publicUrl;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
