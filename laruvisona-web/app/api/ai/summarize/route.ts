import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { text } = await req.json() as { text: string };
  if (!text || text.length < 10) return NextResponse.json({ error: 'text required' }, { status: 400 });

  const client = new Anthropic();
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: `以下の問い合わせ内容を日本語で2〜3文に要約してください。重要な要望や懸念点を含めてください。\n\n${text}`,
    }],
  });

  const summary = (msg.content[0] as { type: string; text: string }).text?.trim() || null;
  return NextResponse.json({ summary });
}
