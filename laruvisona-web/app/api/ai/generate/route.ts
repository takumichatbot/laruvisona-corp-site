import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { industry, businessName, address, phone, description, catchphrase, services } = await req.json();

  const industryMap: Record<string, string> = {
    restaurant: '飲食店・カフェ',
    beauty: '美容室・サロン',
    clinic: '整体・クリニック',
    legal: '士業・コンサル',
    construction: '建設・工務店',
    realestate: '不動産',
    retail: '小売・EC',
    fitness: 'フィットネス・ジム',
    hotel: 'ホテル・旅館',
    education: '教育・スクール',
  };

  const prompt = `あなたはプロのコピーライターです。以下の情報をもとに、ホームページ用のテキストコンテンツを生成してください。

## ビジネス情報
- 業種: ${industryMap[industry] || industry}
- 店舗・会社名: ${businessName}
- 住所: ${address}
- 電話番号: ${phone}
- 既存の紹介文: ${description || 'なし'}
- キャッチフレーズ: ${catchphrase || 'なし'}
- サービス: ${services?.filter((s: {name:string}) => s.name).map((s: {name:string; description:string; price:string}) => `${s.name}(${s.price || '価格未定'})`).join('、') || 'なし'}

## 出力形式（JSON）
以下のJSONフォーマットで出力してください。他のテキストは一切不要です。

{
  "heroHeading": "ヒーローセクションの見出し（15文字以内）",
  "heroSubheading": "サブタイトル（40文字以内）",
  "aboutHeading": "会社紹介セクションの見出し（20文字以内）",
  "aboutText": "会社・店舗の紹介文（150〜200文字）。業種の特性を活かし、信頼感と専門性が伝わるように。",
  "ctaText": "CTAボタンのテキスト（10文字以内）",
  "seoTitle": "ページタイトル（50文字以内、地域名・業種・店名を含む）",
  "seoDescription": "メタディスクリプション（120文字以内）",
  "keywords": "SEOキーワード3〜5個（カンマ区切り）"
}`;

  const message = await getAnthropic().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const rawText = message.content[0].type === 'text' ? message.content[0].text : '';

  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return NextResponse.json({ error: 'AI response parse failed' }, { status: 500 });
  }

  const generated = JSON.parse(jsonMatch[0]);
  return NextResponse.json({ generated });
}
