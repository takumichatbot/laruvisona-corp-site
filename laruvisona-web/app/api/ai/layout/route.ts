import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

type BlockType =
  | 'hero' | 'heading' | 'paragraph' | 'image'
  | 'two-col' | 'three-col' | 'divider' | 'cta'
  | 'services' | 'testimonials' | 'faq' | 'contact'
  | 'hours' | 'gallery' | 'larubot'
  | 'video' | 'map' | 'countdown' | 'price-table' | 'booking' | 'news';

const BLOCK_DESCRIPTIONS: Record<BlockType, string> = {
  hero: 'ヒーローセクション（最初に表示される大きな見出し）',
  heading: 'セクション見出し（区切りに使う）',
  paragraph: '本文テキスト',
  image: '画像',
  'two-col': '2カラムレイアウト',
  'three-col': '3カラムレイアウト',
  divider: '区切り線',
  cta: 'CTAボタン（行動促進）',
  services: 'サービス・料金一覧',
  testimonials: 'お客様の声',
  faq: 'よくある質問',
  contact: 'お問い合わせフォーム',
  hours: '営業時間',
  gallery: '写真ギャラリー',
  larubot: 'LARUbot AIチャット',
  video: 'YouTube/Vimeo動画埋め込み',
  map: 'Google Mapsマップ',
  countdown: 'カウントダウンタイマー',
  'price-table': '料金プラン比較表',
  booking: '予約フォーム（日時・サービス選択）',
  news: 'お知らせ・ニュース',
};

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

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { industry, businessName, description, services, hasBooking, hasVideo, hasGallery } = await req.json();

  const blockList = Object.entries(BLOCK_DESCRIPTIONS)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');

  const prompt = `あなたはホームページ設計の専門家です。以下のビジネス情報に最適なブロック構成を提案してください。

## ビジネス情報
- 業種: ${industryMap[industry] || industry}
- 店舗名: ${businessName}
- 説明: ${description || 'なし'}
- サービス: ${services?.map((s: { name: string }) => s.name).filter(Boolean).join('、') || 'なし'}
- 予約機能: ${hasBooking ? 'あり' : 'なし'}
- 動画: ${hasVideo ? 'あり' : 'なし'}
- ギャラリー: ${hasGallery ? 'あり' : 'なし'}

## 利用可能なブロック
${blockList}

## 要件
- 8〜14個のブロックを選ぶ（多すぎず少なすぎず）
- ユーザーが最も欲しい情報順に並べる
- hero は必ず先頭
- contact または booking を末尾に近い位置に配置
- この業種に特に重要なブロックを優先

## 出力形式（JSON のみ）
{
  "layout": ["hero", "heading", "services", ...],
  "reasoning": "この構成にした理由（1〜2文）"
}`;

  const message = await getAnthropic().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  });

  const rawText = message.content[0].type === 'text' ? message.content[0].text : '';
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return NextResponse.json({ error: 'Parse failed' }, { status: 500 });
  }

  const result = JSON.parse(jsonMatch[0]);

  // Validate block types
  const valid = new Set(Object.keys(BLOCK_DESCRIPTIONS));
  const layout = (result.layout as string[]).filter(b => valid.has(b)) as BlockType[];

  return NextResponse.json({ layout, reasoning: result.reasoning });
}
