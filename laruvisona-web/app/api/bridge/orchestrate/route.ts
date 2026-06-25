import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function parsePlan(text: string) {
  let s = text.trim();
  const fence = s.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
  if (fence) s = fence[1].trim();
  const brace = s.match(/\{[\s\S]*\}/);
  if (brace) s = brace[0];
  return JSON.parse(s);
}

export async function POST(req: Request) {
  const { directive, projectName, fileTree, model = 'claude-sonnet-4-6', agentConfig = '' } = await req.json();

  if (!directive?.trim()) {
    return new Response(JSON.stringify({ error: 'ディレクティブが必要です' }), { status: 400 });
  }

  const systemPrompt = `あなたはAIソフトウェアチームのリードアーキテクトです。
ユーザーの開発指示を分析し、複数のAIエージェントが段階的・並列実行できる高品質なタスク計画を立案します。

## プロジェクト情報
プロジェクト名: ${projectName}
ファイル構造:
\`\`\`
${(fileTree || '(不明)').slice(0, 3000)}
\`\`\`
${agentConfig ? `\n## カスタムエージェント指示\n${agentConfig}\n` : ''}
## タスク計画のルール

### フェーズ設計の原則
- フェーズ間には厳格な依存関係がある（フェーズ N+1 はフェーズ N の成果物を前提とする）
- 典型的な順序: 型定義/設定 → データ層 → ビジネスロジック → UI → テスト
- 最大4フェーズ、1フェーズ最大4タスク

### 並列性の原則
- 同一フェーズ内のタスクは互いに独立していること（同じファイルを編集しない）
- parallel: true のフェーズは全タスクが独立していることを保証すること

### instruction の品質基準（最重要）
各タスクの instruction は以下を満たすこと:
1. **完全性**: そのタスクだけで実行可能な完全な指示
2. **具体性**: ファイルパス、関数名、型名、テーブル名を明示
3. **文脈性**: 既存コードのパターンへの言及
4. **実行性**: Claude Code が迷わず実行できる詳細さ
5. **整合性**: 同フェーズの他タスクとファイルが重複しないこと

## 出力形式
JSONのみ返してください（コードブロックも説明も不要）:
{
  "title": "計画タイトル（簡潔に）",
  "description": "全体概要（2-3行）",
  "phases": [
    {
      "id": "phase_1",
      "name": "フェーズ名",
      "description": "このフェーズの目的と成果物",
      "parallel": false,
      "tasks": [
        {
          "id": "task_1_1",
          "agent_name": "Agent名（例: Schema Agent）",
          "title": "タスクタイトル（10文字以内）",
          "instruction": "完全で具体的な指示",
          "files_to_create": ["新規ファイルパス"],
          "files_to_modify": ["変更ファイルパス"]
        }
      ]
    }
  ]
}`;

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = client.messages.stream({
          model,
          max_tokens: 6000,
          system: systemPrompt,
          messages: [{ role: 'user', content: `開発指示: ${directive}` }],
        });

        let fullText = '';
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            fullText += event.delta.text;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'token', text: event.delta.text })}\n\n`));
          }
        }

        const plan = parsePlan(fullText);
        if (!plan?.phases?.length) throw new Error('プランの生成に失敗しました');
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', plan })}\n\n`));
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'オーケストレーターエラー';
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: msg })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  });
}
