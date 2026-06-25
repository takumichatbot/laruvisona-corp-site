import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: Request) {
  try {
    const { messages, projectName, model = 'claude-haiku-4-5-20251001' } = await req.json();

    const systemPrompt = `あなたは「Laru Bridge」のAIアシスタントです。
ユーザーのプロジェクト「${projectName}」の開発をサポートしています。
- 日本語で回答してください
- コードに関する質問、設計相談、実装アドバイスが得意です
- コードブロックはmarkdown形式で出力してください
- 簡潔・的確に答えてください`;

    const stream = await client.messages.stream({
      model,
      max_tokens: 2048,
      system: systemPrompt,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`));
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Claude APIエラー';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
