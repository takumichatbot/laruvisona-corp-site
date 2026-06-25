import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

interface DecomposeTask {
  id: string;
  title: string;
  prompt: string;
  deps: string[];
  estimatedMins: number;
}

function topoGroups(tasks: DecomposeTask[]): string[][] {
  const groups: string[][] = [];
  const done = new Set<string>();
  let limit = 30;
  while (done.size < tasks.length && limit-- > 0) {
    const group = tasks
      .filter(t => !done.has(t.id) && t.deps.every(d => done.has(d)))
      .map(t => t.id);
    if (!group.length) break;
    groups.push(group);
    group.forEach(id => done.add(id));
  }
  return groups;
}

export async function POST(req: Request) {
  try {
    const { goal, project, secret } = await req.json() as { goal: string; project: string; secret: string };
    if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!goal?.trim()) return NextResponse.json({ error: 'goal required' }, { status: 400 });

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: `You are a software engineering task planner. Decompose coding goals into 3-7 concrete subtasks.
Return ONLY valid JSON — no markdown fences, no explanation:
{
  "title": "goal title in Japanese (≤15 chars)",
  "tasks": [
    { "id": "t1", "title": "task title in Japanese (≤20 chars)", "prompt": "Detailed Claude Code instruction in Japanese", "deps": [], "estimatedMins": 2 }
  ]
}
Rules:
- deps: IDs of tasks that MUST complete first
- estimatedMins: 1–10
- prompts must be self-contained Claude Code instructions
- IDs: t1, t2, t3 …`,
      messages: [{ role: 'user', content: `Goal: ${goal}\nProject: ${project || '(unspecified)'}` }],
    });

    const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    const plan = JSON.parse(raw) as { title: string; tasks: DecomposeTask[] };
    const parallelGroups = topoGroups(plan.tasks);

    return NextResponse.json({ ...plan, parallelGroups });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
