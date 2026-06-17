import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function extractText(html: string): string {
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
  return text.slice(0, 5000);
}

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
  'Cache-Control': 'no-cache',
};

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: FETCH_HEADERS,
    signal: AbortSignal.timeout(10000),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { url: rawUrl } = await req.json();
  if (!rawUrl) return NextResponse.json({ error: 'URL required' }, { status: 400 });

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return NextResponse.json({ error: 'api_key_missing' }, { status: 500 });

  const httpsUrl = normalizeUrl(rawUrl);
  let pageText = '';
  try {
    const html = await fetchPage(httpsUrl);
    pageText = extractText(html);
  } catch {
    // Fallback: try http if https failed
    if (httpsUrl.startsWith('https://')) {
      try {
        const html = await fetchPage(httpsUrl.replace('https://', 'http://'));
        pageText = extractText(html);
      } catch {
        return NextResponse.json({ error: 'fetch_failed' }, { status: 422 });
      }
    } else {
      return NextResponse.json({ error: 'fetch_failed' }, { status: 422 });
    }
  }

  if (!pageText || pageText.length < 30) {
    return NextResponse.json({ error: 'no_content' }, { status: 422 });
  }

  const genAI = new GoogleGenerativeAI(geminiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

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
