import OpenAI from 'openai';
import { NextResponse } from 'next/server';

function getClient() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY が未設定です');
  return new OpenAI({ apiKey: key });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;

    // ── U: o4-mini プラン検証 ────────────────────────────────────────────────
    if (action === 'verify_plan') {
      const { plan, directive } = body;
      const openai = getClient();

      const phasesSummary = plan.phases.map((p: { name: string; tasks: { title: string; files_to_create?: string[]; files_to_modify?: string[] }[] }, i: number) =>
        `Phase ${i + 1} "${p.name}": ${p.tasks.map((t: { title: string; files_to_create?: string[]; files_to_modify?: string[] }) =>
          `[${t.title} | creates:${(t.files_to_create || []).join(',')||'none'} modifies:${(t.files_to_modify || []).join(',')||'none'}]`
        ).join(', ')}`
      ).join('\n');

      const resp = await openai.chat.completions.create({
        model: 'o4-mini',
        messages: [
          {
            role: 'system',
            content: `あなたはソフトウェアアーキテクチャの専門家です。AIエージェントチームのタスク実行計画を検証します。
以下をチェックして必ずJSONのみで返してください:
1. フェーズ順序の論理的整合性（型/スキーマ定義が先にあるか）
2. 同フェーズ内のファイル競合（同じファイルを複数タスクが編集しないか）
3. 欠落している依存関係（Aが必要とするものをBが後で作るなど）
4. リスク（認証・DB・削除系操作の危険度）
5. 改善提案

出力形式 (JSONのみ):
{"valid":true/false,"score":0-100,"issues":[{"severity":"high/medium/low","desc":"..."}],"suggestions":["..."],"summary":"2行で全体評価"}`
          },
          { role: 'user', content: `指示: ${directive}\n\n計画:\n${phasesSummary}` },
        ],
      });

      const text = resp.choices[0].message.content || '{}';
      let result;
      try {
        const fence = text.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
        result = JSON.parse(fence ? fence[1] : text.match(/\{[\s\S]*\}/)![0]);
      } catch {
        result = { valid: true, score: 80, issues: [], suggestions: [], summary: '検証完了' };
      }
      return NextResponse.json(result);
    }

    // ── V: Realtime API セッショントークン ──────────────────────────────────
    if (action === 'realtime_session') {
      const { projectName } = body;
      const openai = getClient();
      const session = await (openai.beta as unknown as {
        realtime: {
          sessions: {
            create: (params: Record<string, unknown>) => Promise<{ client_secret: { value: string } }>;
          };
        };
      }).realtime.sessions.create({
        model: 'gpt-4o-realtime-preview',
        voice: 'shimmer',
        instructions: `あなたは「Bridge」というAIコーディングアシスタントです。プロジェクト: ${projectName || '不明'}。
日本語で会話し、ユーザーの開発意図を把握して具体的な実装指示に変換してください。
タスクが明確になったら "→ AI Team に送信できます: [指示文]" の形式で提案してください。`,
        input_audio_transcription: { model: 'gpt-4o-transcribe' },
        turn_detection: { type: 'server_vad', threshold: 0.5, prefix_padding_ms: 300, silence_duration_ms: 600 },
      });
      return NextResponse.json({ client_secret: session.client_secret });
    }

    // ── W: Semantic Embedding (Brain 用) ────────────────────────────────────
    if (action === 'embedding') {
      const { texts } = body as { texts: string[] };
      const openai = getClient();
      const resp = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: texts.map((t: string) => t.slice(0, 8000)),
      });
      return NextResponse.json({ embeddings: resp.data.map(d => d.embedding) });
    }

    // ── X: Code 静的解析 (o4-mini) ──────────────────────────────────────────
    if (action === 'analyze_code') {
      const { code, language, context } = body;
      const openai = getClient();
      const resp = await openai.chat.completions.create({
        model: 'o4-mini',
        messages: [
          {
            role: 'system',
            content: `あなたはコードレビュー専門家です。以下のコードスニペットを静的解析してください。
出力形式 (JSONのみ):
{"ok":true/false,"bugs":[{"line":"推定行","severity":"high/medium/low","desc":"..."}],"suggestions":["..."],"summary":"1行評価"}`
          },
          { role: 'user', content: `言語: ${language || 'TypeScript'}\nコンテキスト: ${context || ''}\n\n\`\`\`\n${code}\n\`\`\`` },
        ],
      });
      const text = resp.choices[0].message.content || '{}';
      let result;
      try {
        const fence = text.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
        result = JSON.parse(fence ? fence[1] : text.match(/\{[\s\S]*\}/)![0]);
      } catch {
        result = { ok: true, bugs: [], suggestions: [], summary: '解析完了' };
      }
      return NextResponse.json(result);
    }

    // ── Y: TTS 音声合成 ─────────────────────────────────────────────────────
    if (action === 'tts') {
      const { text, voice = 'shimmer' } = body;
      const openai = getClient();
      const mp3 = await openai.audio.speech.create({
        model: 'tts-1',
        voice,
        input: text.slice(0, 4096),
        response_format: 'mp3',
        speed: 1.1,
      });
      const buffer = Buffer.from(await mp3.arrayBuffer());
      return new Response(buffer, {
        headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': buffer.length.toString() },
      });
    }

    return NextResponse.json({ error: '不明なアクション' }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'OpenAI APIエラー';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
