import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

// POST /api/ai/review-reply
// body: { reviewText, reviewerName, rating, businessName, industry }
// Returns: { replies: string[] }  (3 suggested replies to choose from)

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { reviewText, reviewerName, rating, businessName, industry } = await req.json() as {
    reviewText: string;
    reviewerName?: string;
    rating: number;
    businessName: string;
    industry?: string;
  };

  if (!reviewText || !rating || !businessName) {
    return NextResponse.json({ error: 'reviewText, rating, businessName required' }, { status: 400 });
  }

  const sentiment = rating >= 4 ? 'ポジティブ（高評価）' : rating === 3 ? '中立（普通）' : 'ネガティブ（低評価・クレーム）';

  const prompt = `あなたは日本のローカルビジネス「${businessName}」のオーナーです。
Googleマップの口コミに対して、誠実で親しみやすい返信文を作成してください。

## 口コミ情報
- 投稿者: ${reviewerName || '匿名'}
- 評価: ${rating}★ / 5★ (${sentiment})
- 口コミ内容: 「${reviewText}」
${industry ? `- 業種: ${industry}` : ''}

## 返信のルール
- 必ず「${reviewerName || 'お客様'}様」と呼びかける
- 100〜200文字で簡潔に
- ネガティブな場合は謝罪 + 改善策を提示
- ポジティブな場合は感謝 + 再来店を促す
- 定型文にならないよう自然な言葉で

## 出力形式 (JSONのみ)
{
  "replies": [
    "返信案1（丁寧・フォーマル寄り）",
    "返信案2（親しみやすい・カジュアル寄り）",
    "返信案3（具体的な内容に触れたもの）"
  ]
}`;

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return NextResponse.json({ error: 'Parse failed' }, { status: 500 });

    const parsed = JSON.parse(match[0]) as { replies: string[] };
    return NextResponse.json(parsed);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
