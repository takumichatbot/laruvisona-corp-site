import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

// POST /api/ai/chat-analysis
// Analyzes LARUbot conversation history to extract FAQs and pain points
// body: { siteId }

interface ChatAnalysis {
  faqs: Array<{ question: string; frequency: number; suggestedAnswer: string }>;
  painPoints: Array<{ topic: string; count: number; description: string }>;
  popularTopics: Array<{ topic: string; count: number }>;
  summary: string;
  conversationCount: number;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { siteId } = await req.json() as { siteId: string };
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  // Verify ownership
  const { data: site } = await supabase
    .from('sites')
    .select('id, name, industry')
    .eq('id', siteId)
    .eq('user_id', user.id)
    .single();

  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  const service = await createServiceClient();

  // Fetch last 30 days of conversations
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: conversations } = await service
    .from('larubot_conversations')
    .select('messages, summary, updated_at')
    .eq('site_id', siteId)
    .gte('updated_at', since)
    .order('updated_at', { ascending: false })
    .limit(50);

  if (!conversations || conversations.length === 0) {
    return NextResponse.json({
      ok: true,
      analysis: null,
      message: 'チャット履歴がまだありません。LARUbotを有効にしてしばらくお待ちください。',
    });
  }

  // Extract user messages for analysis
  type Message = { role: 'user' | 'assistant'; content: string };
  const userMessages: string[] = [];
  for (const conv of conversations) {
    const msgs = conv.messages as Message[];
    if (Array.isArray(msgs)) {
      userMessages.push(
        ...msgs
          .filter((m) => m.role === 'user' && m.content?.length > 5)
          .map((m) => m.content.slice(0, 300))
      );
    }
  }

  if (userMessages.length === 0) {
    return NextResponse.json({ ok: true, analysis: null, message: 'ユーザーメッセージが見つかりませんでした。' });
  }

  const prompt = `あなたは「${site.name}」（${site.industry || '事業'}）のLARUbotチャット履歴アナリストです。
過去30日間のユーザーメッセージを分析して、よくある質問・課題・人気トピックを抽出してください。

## ユーザーメッセージ一覧（${userMessages.length}件）
${userMessages.slice(0, 100).map((m, i) => `${i + 1}. ${m}`).join('\n')}

## 出力形式 (JSONのみ)
{
  "faqs": [
    {
      "question": "よく聞かれる質問（自然な言葉で）",
      "frequency": 5,
      "suggestedAnswer": "推奨回答（LARUbotに登録するとよい内容）"
    }
  ],
  "painPoints": [
    {
      "topic": "悩み・課題のカテゴリ",
      "count": 3,
      "description": "どんな課題か・改善のヒント"
    }
  ],
  "popularTopics": [
    { "topic": "話題のトピック名", "count": 8 }
  ],
  "summary": "全体的な傾向の説明（2〜3文）"
}

faqs: 上位5件、painPoints: 上位3件、popularTopics: 上位5件。`;

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return NextResponse.json({ error: 'Parse failed' }, { status: 500 });

    const result = JSON.parse(match[0]) as Omit<ChatAnalysis, 'conversationCount'>;
    const analysis: ChatAnalysis = {
      ...result,
      conversationCount: conversations.length,
    };

    // Cache result
    const { data: existingSettings } = await supabase.from('sites').select('settings_json').eq('id', siteId).single();
    const settings = (existingSettings?.settings_json as Record<string, unknown>) || {};
    await supabase.from('sites').update({
      settings_json: { ...settings, chat_analysis: analysis, chat_analysis_at: new Date().toISOString() },
    }).eq('id', siteId);

    return NextResponse.json({ ok: true, analysis, analyzedAt: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
