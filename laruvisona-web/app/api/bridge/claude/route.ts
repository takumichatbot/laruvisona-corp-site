import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { bridgeText, readBridgeJson } from '@/lib/bridge-input';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 60_000, maxRetries: 1 });
const MODELS = new Set(['claude-haiku-4-5-20251001', 'claude-sonnet-4-6', 'claude-opus-4-8']);

export async function POST(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const { messages, projectName: rawProjectName, model = 'claude-haiku-4-5-20251001', context, systemOverride } = await readBridgeJson(req, 256_000);
    const selectedModel = String(model);
    if (!MODELS.has(selectedModel) || !Array.isArray(messages) || messages.length > 50) {
      return NextResponse.json({ error: '入力を確認してください' }, { status: 400 });
    }
    const safeMessages = messages.map(message => {
      if (!message || typeof message !== 'object') throw Error('invalid');
      const item = message as Record<string, unknown>;
      if (item.role !== 'user' && item.role !== 'assistant') throw Error('invalid');
      return { role: item.role as 'user' | 'assistant', content: bridgeText(item.content, 20_000, true) };
    });
    const safeContext = context == null ? [] : context;
    if (!Array.isArray(safeContext) || safeContext.length > 30) throw Error('invalid');
    const contextItems = safeContext.map(entry => {
      if (!entry || typeof entry !== 'object') throw Error('invalid');
      const item = entry as Record<string, unknown>;
      return { path: bridgeText(item.path, 500, true), content: bridgeText(item.content, 20_000) };
    });
    const projectName = bridgeText(rawProjectName, 200);

    const contextStr = contextItems.length
      ? `\n\n---\n以下はプロジェクトの関連コードです:\n${contextItems.map(c => `# ${c.path}\n\`\`\`\n${c.content.slice(0, 2000)}\n\`\`\``).join('\n\n')}\n---`
      : '';

    const systemPrompt = systemOverride
      ? bridgeText(systemOverride, 20_000, true)
      : `あなたは「Laru Bridge」のAIアシスタントです。
ユーザーのプロジェクト「${projectName}」の開発をサポートしています。
- 日本語で回答してください
- コードに関する質問、設計相談、実装アドバイスが得意です
- コードブロックはmarkdown形式で出力してください
- 簡潔・的確に答えてください${contextStr}`;

    const stream = await client.messages.stream({
      model: selectedModel,
      max_tokens: 2048,
      system: systemPrompt,
      messages: safeMessages,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk.delta.text, delta: chunk.delta.text })}\n\n`));
          }
        }
        const finalMsg = await stream.finalMessage();
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ usage: finalMsg.usage, model: selectedModel })}\n\n`));
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
    console.error('[bridge/claude] failed', e instanceof Error ? e.name : 'unknown');
    return NextResponse.json({ error: 'Claude APIエラー' }, { status: 502 });
  }
}
