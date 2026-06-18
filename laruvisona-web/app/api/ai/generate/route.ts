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

const industryToneGuide: Record<string, string> = {
  restaurant: '温かみ・食欲・こだわり・地産地消・手作り感を前面に出す。「旬の食材」「こだわりの一品」など感覚に訴える言葉を使う。',
  beauty: '美しさ・リラックス・プロの技術・自分へのご褒美感を表現。「丁寧なカウンセリング」「あなただけの」などパーソナル感を出す。',
  clinic: '安心・信頼・専門知識・根本改善・科学的アプローチ。「国家資格」「実績N年」などの信頼指標を含める。医療的な正確さを重視。',
  legal: '信頼・専門性・守秘義務・問題解決・安心感。「豊富な経験」「丁寧なヒアリング」「秘密厳守」などの安心ワードを使う。',
  construction: '技術力・職人気質・地域密着・アフターサポート・耐久性。「創業N年」「施工実績N件」などの実績数字を使う。',
  realestate: '信頼・地域知識・ライフスタイル提案・安心取引。「地域No.1」「丁寧な説明」「あなたの理想の住まい」などを使う。',
  retail: '品揃え・利便性・お得感・品質保証。商品の魅力と購買後のメリットを明確に伝える。',
  fitness: 'モチベーション・変化・達成感・サポート体制・継続しやすさ。「理想のBody」「プロのサポート」などを使う。',
  hotel: 'おもてなし・非日常・快適さ・記念日・思い出。「特別なひととき」「至福のひとときを」など感情に訴える表現を使う。',
  education: '成長・可能性・丁寧な指導・実績・保護者の安心感。「一人ひとりに合わせた」「確かな実績」などを使う。',
  wedding: '感動・一生の思い出・こだわり・二人らしさ・幸せ。「おふたりだけの」「一生に一度」などの感情訴求を最優先に。',
  pet: '愛情・安心・プロケア・ペットの笑顔。「大切な家族」「愛情たっぷり」などのペット愛を伝える表現を使う。',
  other: '誠実さ・専門性・地域貢献・お客様第一。具体的な価値提供を明確に伝える。',
};

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { industry, businessName, address, phone, email, description, catchphrase, services, style } = await req.json();

  const industryLabel = industryMap[industry] || industry;
  const toneGuide = industryToneGuide[industry] || industryToneGuide.other;
  const serviceList = services
    ?.filter((s: { name: string }) => s.name)
    .map((s: { name: string; price: string }) => `${s.name}（${s.price || '価格未定'}）`)
    .join('、') || 'なし';
  const area = address?.split('区')[0]?.split('市')[0]?.replace(/東京都|大阪府|神奈川県|埼玉県|千葉県|愛知県|福岡県|北海道/, '') || '地域';

  const prompt = `あなたは日本のプロコピーライターであり、地域密着型ビジネスのウェブサイト制作の専門家です。
以下のビジネス情報を基に、ホームページ用の高品質なテキストをJSONで生成してください。

## ビジネス情報
- 業種: ${industryLabel}
- 店舗・会社名: ${businessName}
- 所在地: ${address}
- 電話番号: ${phone}
- メール: ${email}
- 既存の紹介文: ${description || 'なし'}
- キャッチフレーズ: ${catchphrase || 'なし'}
- サービス・メニュー: ${serviceList}
- デザインスタイル: ${style || 'modern'}

## コピーライティング指針（必ず守ること）
- ${toneGuide}
- heroHeadingは「テンプレートっぽい」フレーズを避け、この店・会社だけのオリジナル感を出す
- 地域名「${area}」を見出しや本文に自然に組み込む（SEO効果も兼ねる）
- お客様の声は業種に合った具体的な体験談で、読んで共感できる内容にする
- FAQは「実際に電話で聞かれそうな」生活感のある質問にする
- 3つの強みは業種の核心的な差別化ポイントを選ぶ（「丁寧な対応」など抽象的なものは避ける）

## 出力形式（JSONのみ、前後の説明文は不要）

{
  "heroHeading": "ヒーローの見出し（18文字以内。インパクトがあり、業種とエリアが伝わるもの）",
  "heroSubheading": "サブタイトル（50文字以内。主なベネフィットを具体的に。数字や保証があれば含める）",
  "aboutHeading": "会社・店舗紹介の見出し（25文字以内。「私たちについて」より具体的なもの）",
  "aboutText": "紹介文（180〜220文字）。創業背景や理念・実績・スタッフの想いを交えてリアルな魅力を伝える。地名を含める。",
  "ctaText": "CTAボタンのテキスト（12文字以内。緊張感・行動促進・特典感のどれかを含める）",
  "threeColHeading": "3つの強みセクションの見出し（20文字以内）",
  "threeColItems": [
    { "icon": "絵文字1つ", "title": "強み1のタイトル（15文字以内）", "text": "強み1の説明（60文字以内。具体的な数字や事実を含める）" },
    { "icon": "絵文字1つ", "title": "強み2のタイトル（15文字以内）", "text": "強み2の説明（60文字以内）" },
    { "icon": "絵文字1つ", "title": "強み3のタイトル（15文字以内）", "text": "強み3の説明（60文字以内）" }
  ],
  "seoTitle": "ページタイトル（50文字以内。地域名・業種・店名を含む。検索されそうなキーワードを優先）",
  "seoDescription": "メタディスクリプション（120文字以内。クリックしたくなる具体的な内容。電話番号や特典があれば含める）",
  "keywords": "SEOキーワード4〜6個（カンマ区切り。地域名+業種の組み合わせを最優先に）",
  "colorScheme": "${colorSchemeMap[industry] || 'professional-blue'}",
  "faqs": [
    { "q": "よくある質問1（実際に電話でよく聞かれる内容）", "a": "回答1（70文字以内。安心感を与える内容）" },
    { "q": "よくある質問2", "a": "回答2（70文字以内）" },
    { "q": "よくある質問3", "a": "回答3（70文字以内）" },
    { "q": "よくある質問4", "a": "回答4（70文字以内）" }
  ],
  "testimonials": [
    { "name": "実在感のあるお客様名（例:山田様）", "age": "年代（例:40代）", "rating": 5, "text": "お客様の声（80文字以内。業種特有の悩みが解決されたリアルな体験談）" },
    { "name": "お客様名", "age": "年代", "rating": 5, "text": "お客様の声（80文字以内）" },
    { "name": "お客様名", "age": "年代", "rating": 5, "text": "お客様の声（80文字以内）" }
  ]
}`;

  try {
    const message = await getAnthropic().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2500,
      messages: [{ role: 'user', content: prompt }],
    });

    const rawText = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'AI response parse failed' }, { status: 500 });
    }

    const generated = JSON.parse(jsonMatch[0]);

    // Validate required fields are present and non-empty
    const required = ['heroHeading', 'heroSubheading', 'aboutText', 'ctaText', 'seoTitle', 'seoDescription'];
    for (const key of required) {
      if (!generated[key]) {
        return NextResponse.json({ error: `Missing required field: ${key}` }, { status: 500 });
      }
    }

    return NextResponse.json({ generated });
  } catch (e) {
    console.error('AI generate error:', e);
    return NextResponse.json({ error: 'AI generation failed' }, { status: 500 });
  }
}
