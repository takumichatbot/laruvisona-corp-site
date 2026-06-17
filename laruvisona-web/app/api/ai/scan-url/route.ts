import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

function extractText(html: string): string {
  // Strip scripts, styles, nav, footer, head
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  // Limit to ~4000 chars to stay within token budget
  return text.slice(0, 4000);
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { url } = await req.json();
  if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400 });

  // Fetch the target page
  let pageText = '';
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LaruHPBot/1.0)' },
      signal: AbortSignal.timeout(8000),
    });
    const html = await res.text();
    pageText = extractText(html);
  } catch {
    return NextResponse.json({ error: 'fetch_failed' }, { status: 422 });
  }

  if (!pageText || pageText.length < 50) {
    return NextResponse.json({ error: 'no_content' }, { status: 422 });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });

  const genAI = new GoogleGenerativeAI(geminiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = `以下のウェブサイトのテキストコンテンツを解析して、ビジネス情報を抽出してください。

ウェブサイトテキスト:
"""
${pageText}
"""

以下の情報を抽出してJSON形式で返してください。情報がない場合は空文字列にしてください。

{
  "businessName": "店舗・会社名",
  "phone": "電話番号（ハイフンあり形式）",
  "address": "住所（都道府県から）",
  "email": "メールアドレス",
  "description": "お店・会社の説明文（200文字以内にまとめる）",
  "catchphrase": "キャッチフレーズ・スローガン（あれば）",
  "services": [
    { "name": "サービス名1", "description": "説明", "price": "価格（あれば）" },
    { "name": "サービス名2", "description": "説明", "price": "価格（あれば）" }
  ],
  "industry": "業種（restaurant/beauty/clinic/legal/construction/realestate/retail/fitness/hotel/education/wedding/pet/other のどれか）",
  "hours": "営業時間（テキストで、なければ空）"
}

JSONのみを返してください。説明文は不要です。`;

  try {
    const result = await model.generateContent(prompt);
    const raw = result.response.text();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ error: 'parse_failed' }, { status: 500 });
    const extracted = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ extracted });
  } catch {
    return NextResponse.json({ error: 'ai_failed' }, { status: 500 });
  }
}
