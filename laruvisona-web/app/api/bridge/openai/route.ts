import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { bridgeText, readBridgeJson } from '@/lib/bridge-input';

type PlanPhase = { name: string; tasks: { title: string; files_to_create?: string[]; files_to_modify?: string[] }[] };

function planPhases(value: unknown): PlanPhase[] {
  if (!value || typeof value !== 'object') throw Error('invalid');
  const phases = (value as Record<string, unknown>).phases;
  if (!Array.isArray(phases) || phases.length > 30) throw Error('invalid');
  return phases.map(phase => {
    if (!phase || typeof phase !== 'object') throw Error('invalid');
    const item = phase as Record<string, unknown>;
    if (!Array.isArray(item.tasks) || item.tasks.length > 100) throw Error('invalid');
    return {
      name: bridgeText(item.name, 500, true),
      tasks: item.tasks.map(task => {
        if (!task || typeof task !== 'object') throw Error('invalid');
        const entry = task as Record<string, unknown>;
        const stringList = (value: unknown) => value == null ? undefined
          : Array.isArray(value) && value.length <= 100
            ? value.map(path => bridgeText(path, 500, true))
            : (() => { throw Error('invalid'); })();
        return { title: bridgeText(entry.title, 1_000, true), files_to_create: stringList(entry.files_to_create), files_to_modify: stringList(entry.files_to_modify) };
      }),
    };
  });
}

function getClient() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY が未設定です');
  return new OpenAI({ apiKey: key, timeout: 60_000, maxRetries: 1 });
}

export async function POST(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await readBridgeJson(req, 1024 * 1024);
    const { action } = body;

    // ── U: o4-mini プラン検証 ────────────────────────────────────────────────
    if (action === 'verify_plan') {
      const phases = planPhases(body.plan);
      const directive = bridgeText(body.directive, 100_000, true);
      const openai = getClient();

      const phasesSummary = phases.map((p, i: number) =>
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
      const projectName = bridgeText(body.projectName, 200);
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error('OPENAI_API_KEY が未設定です');

      // SDK の beta.realtime はバージョン依存のため直接 REST で取得
      // OpenAI-Beta ヘッダーが必要、sessions API は最小パラメータのみ受け付ける
      const resp = await fetch('https://api.openai.com/v1/realtime/sessions', {
        method: 'POST',
        signal: AbortSignal.timeout(30_000),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'realtime=v1',
        },
        body: JSON.stringify({
          model: 'gpt-4o-realtime-preview-2024-12-17',
          voice: 'shimmer',
          instructions: `あなたは「Bridge」というAIコーディングアシスタントです。プロジェクト: ${projectName || '不明'}。日本語で会話し、ユーザーの開発意図を把握して具体的な実装指示に変換してください。タスクが明確になったら "→ AI Team に送信できます: [指示文]" の形式で提案してください。`,
        }),
      });

      if (!resp.ok) {
        await resp.body?.cancel();
        throw new Error(`Realtime sessions ${resp.status}`);
      }
      const session = await resp.json() as { client_secret: { value: string } };
      return NextResponse.json({ client_secret: session.client_secret });
    }

    // ── W: Semantic Embedding (Brain 用) ────────────────────────────────────
    if (action === 'embedding') {
      if (!Array.isArray(body.texts) || body.texts.length > 100) throw Error('invalid');
      const texts = body.texts.map(text => bridgeText(text, 8_000, true));
      const openai = getClient();
      const resp = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: texts.map((t: string) => t.slice(0, 8000)),
      });
      return NextResponse.json({ embeddings: resp.data.map(d => d.embedding) });
    }

    // ── X: Code 静的解析 (o4-mini) ──────────────────────────────────────────
    if (action === 'analyze_code') {
      const code = bridgeText(body.code, 500_000, true);
      const language = bridgeText(body.language, 100);
      const context = bridgeText(body.context, 20_000);
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
      const text = bridgeText(body.text, 4_096, true);
      const voice = bridgeText(body.voice, 50) || 'shimmer';
      const voices = new Set(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']);
      if (!voices.has(voice)) throw Error('invalid');
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
    console.error('[bridge/openai] failed', e instanceof Error ? e.name : 'unknown');
    return NextResponse.json({ error: 'OpenAI APIエラー' }, { status: 502 });
  }
}
