import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

interface LeadScore {
  conversationId: string;
  score: number; // 0-100
  intent: 'hot' | 'warm' | 'cold';
  reasons: string[];
  suggestedAction: string;
  estimatedValue?: number;
}

// Per-user rate limit: 5 lead-score requests per hour
const _leadScoreRateMap = new Map<string, number[]>();
function checkLeadScoreRate(userId: string): boolean {
  const now = Date.now();
  const window = 3600_000;
  const prev = (_leadScoreRateMap.get(userId) ?? []).filter(t => now - t < window);
  if (prev.length >= 5) return false;
  _leadScoreRateMap.set(userId, [...prev, now]);
  return true;
}

// POST /api/ai/lead-score — score recent conversations for buying intent
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!checkLeadScoreRate(user.id)) {
    return NextResponse.json({ error: '1時間あたりのスコアリング上限（5回）に達しました' }, { status: 429 });
  }

  const { siteId } = await req.json() as { siteId: string };
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  const { data: site } = await supabase.from('sites').select('id, name').eq('id', siteId).eq('user_id', user.id).single();
  if (!site) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Fetch recent conversations (last 7 days, max 30)
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data: conversations } = await supabase
    .from('larubot_conversations')
    .select('id, messages, created_at')
    .eq('site_id', siteId)
    .gte('created_at', weekAgo)
    .order('created_at', { ascending: false })
    .limit(30);

  if (!conversations?.length) {
    return NextResponse.json({ scores: [], message: '直近7日間の会話がありません' });
  }

  // Build prompt with conversation summaries
  const convSummaries = conversations.map((conv, i) => {
    const msgs = (conv.messages as Array<{ role: string; content: string }>) || [];
    const userMsgs = msgs.filter(m => m.role === 'user').map(m => m.content).join(' / ').slice(0, 300);
    return `[会話${i + 1}] ID:${conv.id}\nユーザー発言: ${userMsgs}`;
  }).join('\n\n');

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const prompt = `あなたは日本のBtoCビジネス向けのリードスコアリング専門家です。

以下は「${site.name}」のウェブサイトで発生したチャット会話のリストです。
各会話のユーザー発言を分析して、購買意図スコア（0〜100）を算出してください。

スコア基準:
- 80-100（HOT）: 価格確認・予約意向・具体的な日程や数量の質問
- 50-79（WARM）: サービス詳細への興味・比較検討・複数回のやり取り
- 0-49（COLD）: 一般的な情報収集・FAQ的な質問・探索段階

会話一覧:
${convSummaries}

以下のJSON配列形式で返答してください：
[
  {
    "conversationId": "会話のID",
    "score": 75,
    "intent": "warm",
    "reasons": ["理由1", "理由2"],
    "suggestedAction": "次のアクション提案",
    "estimatedValue": 50000
  }
]

estimatedValueは見込み売上金額（円）の推定。不明な場合はnull。
JSON以外は一切出力しないでください。`;

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = (message.content[0] as { type: string; text: string }).text.trim();
  const jsonMatch = raw.match(/\[[\s\S]*\]/);

  let scores: LeadScore[] = [];
  if (jsonMatch) {
    try {
      scores = JSON.parse(jsonMatch[0]) as LeadScore[];
    } catch {
      scores = [];
    }
  }

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  // Cache in settings_json
  const { data: currentSite } = await supabase.from('sites').select('settings_json').eq('id', siteId).single();
  const settings = (currentSite?.settings_json as Record<string, unknown>) || {};
  await supabase.from('sites').update({
    settings_json: {
      ...settings,
      lead_scores: { scores, analyzedAt: new Date().toISOString() },
    },
  }).eq('id', siteId);

  return NextResponse.json({ scores, conversationCount: conversations.length });
}
