import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: Request) {
  try {
    const { directive, projectName, fileTree, model = 'claude-sonnet-4-6' } = await req.json();

    if (!directive?.trim()) return NextResponse.json({ error: 'ディレクティブが必要です' }, { status: 400 });

    const systemPrompt = `あなたはAIソフトウェアチームのリードアーキテクトです。
ユーザーの開発指示を分析し、複数のAIエージェントが段階的・並列実行できる高品質なタスク計画を立案します。

## プロジェクト情報
プロジェクト名: ${projectName}
ファイル構造:
\`\`\`
${(fileTree || '(不明)').slice(0, 3000)}
\`\`\`

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
3. **文脈性**: 既存コードのパターンへの言及（例: "既存の /api/users/route.ts と同じパターンで"）
4. **実行性**: Claude Code が迷わず実行できる詳細さ
5. **整合性**: 同フェーズの他タスクとファイルが重複しないこと

### 悪い例
"APIエンドポイントを作成してください"

### 良い例
"app/api/subscriptions/route.ts を新規作成してください。
既存の app/api/users/route.ts と同じパターンに従い、以下を実装してください:
- POST /api/subscriptions: プランID(pro/free)を受け取り、Stripe Checkout セッションを作成して返す
- GET /api/subscriptions: 現在のユーザーのサブスク状態を返す
- DELETE /api/subscriptions: サブスクをキャンセル
NextAuthのsessionからuserIdを取得すること。Stripe SDKはpackage.jsonに既にあるか確認し、なければnpm installを実行すること。"

## 出力形式
JSONのみ返してください（コードブロックも説明も不要）:
{
  "title": "計画タイトル（簡潔に）",
  "description": "全体概要（2-3行、何を・なぜ・どのように）",
  "phases": [
    {
      "id": "phase_1",
      "name": "フェーズ名",
      "description": "このフェーズの目的と成果物",
      "parallel": false,
      "tasks": [
        {
          "id": "task_1_1",
          "agent_name": "わかりやすいAgent名（例: Schema Agent）",
          "title": "タスクのタイトル（10文字以内）",
          "instruction": "完全で具体的な指示（上記品質基準を満たすこと）",
          "files_to_create": ["新規作成するファイルパス"],
          "files_to_modify": ["変更するファイルパス"]
        }
      ]
    }
  ]
}`;

    const response = await client.messages.create({
      model,
      max_tokens: 6000,
      system: systemPrompt,
      messages: [{ role: 'user', content: `開発指示: ${directive}` }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    // Extract JSON (handle potential markdown code fences)
    let jsonStr = text.trim();
    const fenceMatch = jsonStr.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
    if (fenceMatch) jsonStr = fenceMatch[1].trim();
    const braceMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (braceMatch) jsonStr = braceMatch[0];

    let plan;
    try {
      plan = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json({ error: 'プラン生成失敗: JSONパースエラー', raw: text.slice(0, 500) }, { status: 500 });
    }

    return NextResponse.json({ plan });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'オーケストレーターエラー';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
