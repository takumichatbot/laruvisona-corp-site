import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';
import { readAiJson, requireAiAccess } from '@/lib/ai-access';

const LOCALE_NAMES: Record<string, string> = {
  en: 'English',
  zh: '中文（简体）',
  ko: '한국어',
};

// POST /api/ai/translate — translate site content to target locale
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied=await requireAiAccess(supabase,user.id,'assistant',30);
  if(denied)return denied;
  const parsed=await readAiJson(req,64_000);
  if(!parsed.ok)return parsed.response;

  const { siteId, targetLocale } = parsed.data as { siteId: string; targetLocale: string };

  if (!siteId || !targetLocale) {
    return NextResponse.json({ error: 'siteId and targetLocale required' }, { status: 400 });
  }

  if (!LOCALE_NAMES[targetLocale]) {
    return NextResponse.json({ error: 'Unsupported locale. Use: en, zh, ko' }, { status: 400 });
  }

  const { data: site } = await supabase
    .from('sites')
    .select('name, blocks_json, seo_json, settings_json')
    .eq('id', siteId)
    .eq('user_id', user.id)
    .single();

  if (!site) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // ブロックから文章を集める。
  // 以前は block.props / block.children を見ていたが、このアプリのブロックは
  // { id, type, data } で、複数ページは { v:2, pages:[...] } に入っている。
  // そのため、集まる文章がほぼ空になり、翻訳してもページの中身が変わらなかった。
  const SKIP_KEYS = new Set([
    'src', 'href', 'url', 'id', 'anchorId', 'bgImage', 'image', 'imageUrl', 'link', 'ctaLink',
    'bgColor', 'textColor', 'buttonColor', 'color', 'icon', 'mode', 'type', 'align', 'variant',
    'priceId', 'formId', 'embed', 'videoUrl', 'mapUrl', 'redirectUrl',
  ]);
  function extractFromData(value: unknown, depth = 0): string[] {
    if (depth > 6) return [];
    if (typeof value === 'string') {
      const text = value.trim();
      // 色コード・URL・記号だけのものは訳さない
      if (!text || /^#[0-9a-f]{3,8}$/i.test(text) || /^https?:\/\//i.test(text) || !/[^\W\d_]/u.test(text)) return [];
      return [text];
    }
    if (Array.isArray(value)) return value.flatMap(v => extractFromData(v, depth + 1));
    if (value && typeof value === 'object') {
      return Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !SKIP_KEYS.has(key))
        .flatMap(([, v]) => extractFromData(v, depth + 1));
    }
    return [];
  }
  function extractTexts(raw: unknown): string[] {
    const pages = Array.isArray(raw)
      ? [{ blocks: raw }]
      : ((raw as { v?: number; pages?: { blocks?: unknown[] }[] } | null)?.pages ?? []);
    return pages.flatMap(page => (page.blocks || []).flatMap((block) => {
      const data = (block as { data?: unknown })?.data;
      return extractFromData(data);
    }));
  }

  const blocks = site.blocks_json;
  const seo = (site.seo_json as Record<string, string>) || {};

  const sourceTexts: string[] = [
    site.name,
    ...(seo.title ? [seo.title] : []),
    ...(seo.description ? [seo.description] : []),
    ...extractTexts(blocks),
  ].filter(Boolean);

  // Deduplicate and sanitize: strip control chars, limit per-item length
  const unique = [...new Set(sourceTexts)]
    .map(t => t.replace(/[\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500))
    .filter(Boolean)
    .slice(0, 200);

  if (!unique.length) {
    return NextResponse.json({ error: 'No text content found to translate' }, { status: 400 });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const prompt = `You are a professional Japanese→${LOCALE_NAMES[targetLocale]} translator specializing in business websites.

Translate the following JSON array of Japanese strings into ${LOCALE_NAMES[targetLocale]}.
- Maintain professional business tone
- Preserve proper nouns (brand names, place names) if appropriate
- Return ONLY a valid JSON array of translated strings in the same order
- Do not add explanations

Source texts (JSON array):
${JSON.stringify(unique)}`;

  let message;
  try {
    message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });
  } catch {
    return NextResponse.json({ error: '翻訳サービスへの接続に失敗しました' }, { status: 503 });
  }

  const raw = (message.content[0] as { type: string; text: string }).text.trim();
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    return NextResponse.json({ error: '翻訳結果の形式が不正です' }, { status: 500 });
  }

  let translated: string[];
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) throw new Error('not array');
    translated = parsed.map(t => (typeof t === 'string' ? t : String(t)));
  } catch {
    return NextResponse.json({ error: '翻訳結果の解析に失敗しました' }, { status: 500 });
  }

  // Build translation map
  const translationMap: Record<string, string> = {};
  unique.forEach((src, i) => {
    if (translated[i]) translationMap[src] = translated[i];
  });

  // Save to settings_json.translations
  const settings = (site.settings_json as Record<string, unknown>) || {};
  const existingTranslations = (settings.translations as Record<string, unknown>) || {};
  const merged = {
    ...settings,
    translations: {
      ...existingTranslations,
      [targetLocale]: {
        map: translationMap,
        translatedAt: new Date().toISOString(),
        textCount: unique.length,
      },
    },
  };

  await supabase.from('sites').update({ settings_json: merged }).eq('id', siteId);

  return NextResponse.json({
    locale: targetLocale,
    textCount: unique.length,
    sample: Object.entries(translationMap).slice(0, 5).map(([src, dst]) => ({ src, dst })),
  });
}
