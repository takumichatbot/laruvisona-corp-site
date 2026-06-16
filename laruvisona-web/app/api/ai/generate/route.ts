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

  const colorSchemeMap: Record<string, string> = {
    restaurant: 'warm-orange',
    beauty: 'elegant-purple',
    clinic: 'professional-blue',
    legal: 'professional-blue',
    construction: 'clean-white',
    realestate: 'professional-blue',
    retail: 'warm-orange',
    fitness: 'nature-green',
    hotel: 'elegant-purple',
    education: 'nature-green',
  };

  const industryLabel = industryMap[industry] || industry;
  const serviceList = services
    ?.filter((s: { name: string }) => s.name)
    .map((s: { name: string; price: string }) => `${s.name}（${s.price || '価格未定'}）`)
    .join('、') || 'なし';

  const prompt = `あなたはプロのコピーライター兼ウェブデザイナーです。以下のビジネス情報を基に、ホームページ用のテキストと設定を生成してください。

## ビジネス情報
- 業種: ${industryLabel}
- 店舗・会社名: ${businessName}
- 所在地: ${address}
- 電話番号: ${phone}
- 既存の紹介文: ${description || 'なし'}
- キャッチフレーズ: ${catchphrase || 'なし'}
- サービス: ${serviceList}

## 生成要件
- ターゲット顧客に刺さる言葉を使うこと
- 業種の特性（${industryLabel}）に合ったトーンと専門用語を使うこと
- 信頼感・専門性・親しみやすさのバランスをとること
- 地域密着型のビジネスであれば地域名を活かすこと

## 出力形式（JSON のみ、他のテキスト不要）

{
  "heroHeading": "ヒーローの見出し（15文字以内、インパクト重視）",
  "heroSubheading": "サブタイトル（40文字以内、ベネフィットを伝える）",
  "aboutHeading": "会社・店舗紹介の見出し（20文字以内）",
  "aboutText": "紹介文（150〜200文字）。業種の特性を活かし、信頼感と専門性が伝わるように。具体的な数字や実績があれば含める。",
  "ctaText": "CTAボタンのテキスト（10文字以内、行動を促す言葉）",
  "seoTitle": "ページタイトル（50文字以内、地域名・業種・店名を含む）",
  "seoDescription": "メタディスクリプション（120文字以内、クリックしたくなる内容）",
  "keywords": "SEOキーワード3〜5個（カンマ区切り）",
  "colorScheme": "${colorSchemeMap[industry] || 'professional-blue'}"
}`;

  const message = await getAnthropic().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
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
