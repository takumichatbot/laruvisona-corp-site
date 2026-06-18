import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { businessName, industry, description, phone, address, services, colorScheme } = await req.json();

  const prompt = `あなたはウェブサイトのコンテンツ生成AIです。以下のビジネス情報を元に、日本語で魅力的なウェブサイトコンテンツを生成してください。

ビジネス名: ${businessName}
業種: ${industry}
説明: ${description}
電話: ${phone || 'なし'}
住所: ${address || 'なし'}
サービス: ${JSON.stringify(services || [])}

以下のJSON形式で返してください。必ずJSONのみ返してください：
{
  "hero": {
    "heading": "キャッチコピー（20文字以内）",
    "subheading": "サブキャッチ（40文字以内）",
    "buttonText": "CTAボタンテキスト"
  },
  "about": {
    "heading": "About セクション見出し",
    "text": "会社・サービス紹介文（150文字程度）"
  },
  "services": [
    { "name": "サービス名", "description": "説明（50文字）", "price": "料金" }
  ],
  "faq": [
    { "q": "よくある質問", "a": "回答" }
  ],
  "cta": {
    "heading": "CTAセクション見出し",
    "text": "CTA説明文",
    "buttonText": "ボタンテキスト"
  }
}`;

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = (message.content[0] as { type: string; text: string }).text;
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return NextResponse.json({ error: 'Parse error' }, { status: 500 });

  try {
    const data = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ ok: true, data, colorScheme: colorScheme || 'professional-blue' });
  } catch {
    return NextResponse.json({ error: 'JSON parse error' }, { status: 500 });
  }
}
