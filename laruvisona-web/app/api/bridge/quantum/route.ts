import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

const QUANTUM_BASES = [
  {
    id: 'impl',
    name: '実装視点',
    color: '#38BDF8',
    glyph: '⟨ψ₁|',
    system: 'シニアエンジニアとして、具体的な実装手順・コードパターンの観点から考えてください。',
  },
  {
    id: 'arch',
    name: '設計視点',
    color: '#A78BFA',
    glyph: '⟨ψ₂|',
    system: 'ソフトウェアアーキテクトとして、システム設計・責務分離・拡張性の観点から考えてください。',
  },
  {
    id: 'risk',
    name: 'リスク視点',
    color: '#F87171',
    glyph: '⟨ψ₃|',
    system: 'セキュリティ＆品質専門家として、脆弱性・エッジケース・テスト容易性の観点から考えてください。',
  },
  {
    id: 'perf',
    name: '効率視点',
    color: '#34D399',
    glyph: '⟨ψ₄|',
    system: 'パフォーマンスエンジニアとして、計算量・メモリ・レンダリング最適化の観点から考えてください。',
  },
  {
    id: 'inno',
    name: '革新視点',
    color: '#FBBF24',
    glyph: '⟨ψ₅|',
    system: '創造的思考者として、型破りなアプローチや新技術の活用を探ってください。',
  },
];

export interface QuantumBranch {
  id: string;
  name: string;
  color: string;
  glyph: string;
  insight: string;
  coherence: number;
}

export async function POST(req: Request) {
  try {
    const { goal, project, secret, numBranches = 3 } = await req.json() as {
      goal: string; project: string; secret: string; numBranches?: number;
    };

    if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!goal?.trim()) return NextResponse.json({ error: 'goal required' }, { status: 400 });

    const bases = QUANTUM_BASES.slice(0, Math.min(Math.max(numBranches, 2), 5));

    // Phase 1: Quantum superposition — explore all branches in parallel
    const branches: QuantumBranch[] = await Promise.all(
      bases.map(async (basis) => {
        const res = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 400,
          system: `${basis.system}\nプロジェクト: ${project || '未指定'}\n日本語で150〜250文字で簡潔に。見出しや箇条書き不要。`,
          messages: [{ role: 'user', content: goal }],
        });
        const insight = res.content[0].type === 'text' ? res.content[0].text.trim() : '';
        // Coherence score: simulate quantum probability amplitude
        const coherence = Math.round((0.55 + Math.random() * 0.45) * 100) / 100;
        return { id: basis.id, name: basis.name, color: basis.color, glyph: basis.glyph, insight, coherence };
      })
    );

    // Phase 2: Wave function collapse — synthesize into optimal solution
    const collapseInput = branches
      .map((b, i) => `【量子状態${i + 1} / ${b.name} / コヒーレンス ${b.coherence}】\n${b.insight}`)
      .join('\n\n');

    const collapseRes = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1200,
      system: `あなたは量子コンピューター型思考シンセサイザーです。複数の量子状態（異なる視点）を重ね合わせ、波動関数を収束させて最適解を導きます。
プロジェクト: ${project || '未指定'}
各視点の優れた洞察を干渉させて増幅し、矛盾を解消して統合的な答えを日本語で出力してください。
実行可能で具体的に。コヒーレンスの高い視点を重視する。`,
      messages: [{
        role: 'user',
        content: `問題: ${goal}\n\n量子重ね合わせ状態:\n${collapseInput}\n\n→ 波動関数収束: 最善の統合解を導いてください。`,
      }],
    });

    const synthesis = collapseRes.content[0].type === 'text' ? collapseRes.content[0].text.trim() : '';

    // Entanglement map: which branches are most "entangled" with each other
    const entanglement: [number, number, number][] = [];
    for (let i = 0; i < branches.length; i++) {
      for (let j = i + 1; j < branches.length; j++) {
        entanglement.push([i, j, Math.round(Math.random() * 100) / 100]);
      }
    }

    return NextResponse.json({ branches, synthesis, entanglement });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
