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

  const { message, blocks, selectedBlockId, siteName, industry } = await req.json();
  if (!message) return NextResponse.json({ error: 'message required' }, { status: 400 });

  const blockSummary = (blocks || []).map((b: { id: string; type: string; data: Record<string, unknown> }) => ({
    id: b.id, type: b.type,
    preview: Object.entries(b.data).filter(([, v]) => typeof v === 'string' && (v as string).length > 0 && (v as string).length < 200)
      .slice(0, 4).map(([k, v]) => `${k}: ${v}`).join(', '),
  }));

  const systemPrompt = `あなたはウェブサイトビルダーのAIアシスタントです。
ユーザーのサイト「${siteName || 'サイト'}」（業種: ${industry || '未設定'}）の編集を手伝います。

現在のブロック一覧:
${JSON.stringify(blockSummary, null, 2)}
${selectedBlockId ? `\n現在選択中のブロックID: ${selectedBlockId}` : ''}

ユーザーの指示を解釈して以下のJSON形式で返答してください:
{
  "reply": "日本語での返答メッセージ（何をしたか、またはできない場合の理由）",
  "actions": [
    {
      "type": "update_block",
      "blockId": "ブロックのID",
      "data": { "変更するフィールド": "新しい値" }
    }
  ]
}

actionsが不要な場合（質問への回答のみ）は空配列にしてください。
ブロックのデータ変更は既存のフィールドのみ変更し、他は省略してください（マージされます）。
テキスト変更では文字数や雰囲気を適切に合わせてください。`;

  try {
    const anthropic = getAnthropic();
    const result = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: message }],
    });

    const text = result.content[0].type === 'text' ? result.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ reply: text, actions: [] });
    }
    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ reply: parsed.reply || '', actions: parsed.actions || [] });
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    console.error('chat-edit error', errorMsg);

    if (errorMsg.includes('blocked by content filtering policy') || errorMsg.includes('content_policy_violation')) {
      return NextResponse.json({
        reply: '申し訳ありません。入力内容がポリシーに引っかかりました。別の表現でお試しください。',
        actions: []
      });
    }

    if (errorMsg.includes('429') || errorMsg.includes('rate limit')) {
      return NextResponse.json({
        reply: '処理が込み合っています。少しお待ちの上、もう一度お試しください。',
        actions: []
      });
    }

    return NextResponse.json({
      reply: 'エラーが発生しました。別の指示でお試しください。',
      actions: []
    });
  }
}
