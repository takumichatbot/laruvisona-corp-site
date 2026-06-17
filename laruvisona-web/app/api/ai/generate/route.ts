import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

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
  wedding: 'ウェディング・ブライダル',
  pet: 'ペットサロン',
  other: 'その他',
};

const colorSchemeMap: Record<string, string> = {
  restaurant: 'warm-earth',
  beauty: 'modern-pink',
  clinic: 'fresh-green',
  legal: 'elegant-dark',
  construction: 'bold-orange',
  realestate: 'professional-blue',
  retail: 'bold-orange',
  fitness: 'bold-orange',
  hotel: 'elegant-dark',
  education: 'professional-blue',
  wedding: 'elegant-dark',
  pet: 'fresh-green',
  other: 'professional-blue',
};

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { industry, businessName, address, phone, email, description, catchphrase, services, style } = await req.json();

  const industryLabel = industryMap[industry] || industry;
  const serviceList = services
    ?.filter((s: { name: string }) => s.name)
    .map((s: { name: string; price: string }) => `${s.name}（${s.price || '価格未定'}）`)
    .join('、') || 'なし';
  const area = address?.split('区')[0]?.split('市')[0]?.replace(/東京都|大阪府|神奈川県|埼玉県|千葉県|愛知県|福岡県|北海道/, '') || '地域';

  const prompt = `あなたはプロのコピーライター兼ウェブデザイナーです。以下のビジネス情報を基に、ホームページ用のテキストを生成してください。

## ビジネス情報
- 業種: ${industryLabel}
- 店舗・会社名: ${businessName}
- 所在地: ${address}
- 電話番号: ${phone}
- メール: ${email}
- 既存の紹介文: ${description || 'なし'}
- キャッチフレーズ: ${catchphrase || 'なし'}
- サービス: ${serviceList}
- デザインスタイル: ${style || 'modern'}

## 生成要件
- ターゲット顧客に刺さる言葉を使うこと
- 業種（${industryLabel}）に合ったトーンと専門用語を使うこと
- 信頼感・専門性・親しみやすさのバランスをとること
- 地域名（${area}）を適度に活かすこと
- FAQは実際によくある質問を想定して自然な内容にすること
- お客様の声は業種に合ったリアルな内容にすること

## 出力形式（JSONのみ、他のテキスト不要）

{
  "heroHeading": "ヒーローの見出し（15文字以内、インパクト重視）",
  "heroSubheading": "サブタイトル（40文字以内、ベネフィットを伝える）",
  "aboutHeading": "会社・店舗紹介の見出し（20文字以内）",
  "aboutText": "紹介文（150〜200文字）。業種の特性を活かし、信頼感と専門性が伝わるように。具体的な数字や実績があれば含める。",
  "ctaText": "CTAボタンのテキスト（10文字以内、行動を促す言葉）",
  "seoTitle": "ページタイトル（50文字以内、地域名・業種・店名を含む）",
  "seoDescription": "メタディスクリプション（120文字以内、クリックしたくなる内容）",
  "keywords": "SEOキーワード3〜5個（カンマ区切り）",
  "colorScheme": "${colorSchemeMap[industry] || 'professional-blue'}",
  "faqs": [
    { "q": "よくある質問1", "a": "回答1（60文字以内）" },
    { "q": "よくある質問2", "a": "回答2（60文字以内）" },
    { "q": "よくある質問3", "a": "回答3（60文字以内）" }
  ],
  "testimonials": [
    { "name": "お客様名（例:田中様）", "age": "年代（例:30代）", "rating": 5, "text": "お客様の声（60文字以内、業種に合ったリアルな感想）" },
    { "name": "お客様名", "age": "年代", "rating": 5, "text": "お客様の声" },
    { "name": "お客様名", "age": "年代", "rating": 5, "text": "お客様の声" }
  ]
}`;

  try {
    const message = await getAnthropic().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const rawText = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'AI response parse failed' }, { status: 500 });
    }

    const generated = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ generated });
  } catch (e) {
    console.error('AI generate error:', e);
    return NextResponse.json({ error: 'AI generation failed' }, { status: 500 });
  }
}
