import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

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

  const { siteId, targetLocale } = await req.json() as { siteId: string; targetLocale: string };

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

  // Extract text content from blocks
  type Block = { type?: string; props?: Record<string, unknown>; children?: Block[] };
  function extractTexts(blocks: Block[]): string[] {
    const texts: string[] = [];
    for (const block of blocks || []) {
      const props = block.props || {};
      for (const [key, val] of Object.entries(props)) {
        if (typeof val === 'string' && val.trim() && key !== 'src' && key !== 'href' && key !== 'url' && key !== 'id') {
          texts.push(val.trim());
        }
      }
      if (block.children) texts.push(...extractTexts(block.children));
    }
    return texts;
  }

  const blocks = (site.blocks_json as Block[]) || [];
  const seo = (site.seo_json as Record<string, string>) || {};

  const sourceTexts: string[] = [
    site.name,
    ...(seo.title ? [seo.title] : []),
    ...(seo.description ? [seo.description] : []),
    ...extractTexts(blocks),
  ].filter(Boolean);

  // Deduplicate
  const unique = [...new Set(sourceTexts)].slice(0, 200);

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

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = (message.content[0] as { type: string; text: string }).text.trim();
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    return NextResponse.json({ error: 'Translation failed: invalid response format' }, { status: 500 });
  }

  let translated: string[];
  try {
    translated = JSON.parse(jsonMatch[0]) as string[];
  } catch {
    return NextResponse.json({ error: 'Translation parse error' }, { status: 500 });
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
