import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export interface SequenceStep {
  delay: number; // hours after trigger or previous step
  subject: string;
  body: string;
}

export interface Sequence {
  id: string;
  name: string;
  trigger: 'contact_form' | 'manual' | 'booking';
  steps: SequenceStep[];
  active: boolean;
  enrolledCount: number;
  createdAt: string;
}

async function getSequences(siteId: string, supabase: Awaited<ReturnType<typeof createClient>>): Promise<Sequence[]> {
  const { data } = await supabase.from('sites').select('settings_json').eq('id', siteId).single();
  const settings = (data?.settings_json as Record<string, unknown>) || {};
  return (settings.sequences as Sequence[]) || [];
}

async function saveSequences(siteId: string, sequences: Sequence[], supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: current } = await supabase.from('sites').select('settings_json').eq('id', siteId).single();
  const merged = { ...(current?.settings_json as Record<string, unknown> || {}), sequences };
  await supabase.from('sites').update({ settings_json: merged }).eq('id', siteId);
}

// GET /api/sequences?siteId=xxx
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get('siteId');
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  const { data: site } = await supabase.from('sites').select('id').eq('id', siteId).eq('user_id', user.id).single();
  if (!site) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const sequences = await getSequences(siteId, supabase);
  return NextResponse.json({ sequences });
}

// POST /api/sequences — create sequence
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { siteId, name, trigger, steps } = await req.json() as {
    siteId: string;
    name: string;
    trigger: Sequence['trigger'];
    steps: SequenceStep[];
  };

  if (!siteId || !name || !steps?.length) {
    return NextResponse.json({ error: 'siteId, name, steps required' }, { status: 400 });
  }

  const { data: site } = await supabase.from('sites').select('id').eq('id', siteId).eq('user_id', user.id).single();
  if (!site) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const sequences = await getSequences(siteId, supabase);
  const newSeq: Sequence = {
    id: Date.now().toString(),
    name,
    trigger: trigger || 'contact_form',
    steps,
    active: false,
    enrolledCount: 0,
    createdAt: new Date().toISOString(),
  };
  sequences.push(newSeq);
  await saveSequences(siteId, sequences, supabase);
  return NextResponse.json({ sequence: newSeq });
}

// PATCH /api/sequences?sequenceId=xxx&siteId=xxx
export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const sequenceId = searchParams.get('sequenceId');
  const siteId = searchParams.get('siteId');
  if (!sequenceId || !siteId) return NextResponse.json({ error: 'sequenceId and siteId required' }, { status: 400 });

  const { data: site } = await supabase.from('sites').select('id').eq('id', siteId).eq('user_id', user.id).single();
  if (!site) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const updates = await req.json() as Partial<Sequence>;
  const sequences = await getSequences(siteId, supabase);
  const idx = sequences.findIndex(s => s.id === sequenceId);
  if (idx === -1) return NextResponse.json({ error: 'Sequence not found' }, { status: 404 });

  sequences[idx] = { ...sequences[idx], ...updates, id: sequenceId };
  await saveSequences(siteId, sequences, supabase);
  return NextResponse.json({ sequence: sequences[idx] });
}

// DELETE /api/sequences?sequenceId=xxx&siteId=xxx
export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const sequenceId = searchParams.get('sequenceId');
  const siteId = searchParams.get('siteId');
  if (!sequenceId || !siteId) return NextResponse.json({ error: 'sequenceId and siteId required' }, { status: 400 });

  const { data: site } = await supabase.from('sites').select('id').eq('id', siteId).eq('user_id', user.id).single();
  if (!site) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const sequences = await getSequences(siteId, supabase);
  const filtered = sequences.filter(s => s.id !== sequenceId);
  await saveSequences(siteId, filtered, supabase);
  return NextResponse.json({ ok: true });
}
