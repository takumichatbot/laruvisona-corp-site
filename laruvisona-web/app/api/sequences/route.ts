import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getSequenceLimit } from '@/lib/plan-limits';
import {
  parseSequenceCreate, parseSequencePatch, readSequenceBody, sequenceId, sequenceSiteId,
  type SequenceRecord, type SequenceStep, type SequenceTrigger,
} from '@/lib/sequence-contract';

type DbSequence = { id: string; name: string; trigger: SequenceTrigger; steps: SequenceStep[]; active: boolean; created_at: string };

async function owner(siteId: string) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: 'ログインしてください' }, { status: 401 }) };
  const { data, error } = await db.from('sites').select('id').eq('id', siteId).eq('user_id', user.id).single();
  if (error || !data) return { response: NextResponse.json({ error: 'サイトが見つかりません' }, { status: 404 }) };
  return { user, db };
}

/**
 * 料金ページで売っている本数を、作る側でも守る。
 * すでに上限を超えて持っている人からは取り上げない（増やせないだけ）。
 */
async function sequenceQuota(
  db: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  email: string | undefined,
  siteId: string,
): Promise<{ response?: NextResponse }> {
  const adminEmails = [process.env.ADMIN_EMAIL, process.env.NEXT_PUBLIC_ADMIN_EMAIL]
    .filter(Boolean).join(',').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  if (adminEmails.includes((email || '').toLowerCase())) return {};

  const { data: profile, error: profileError } = await db
    .from('profiles').select('plan').eq('id', userId).single();
  if (profileError) return { response: NextResponse.json({ error: 'ご契約を確認できませんでした' }, { status: 503 }) };

  const limit = getSequenceLimit((profile?.plan as string | null) ?? null);
  if (limit === 0) {
    return { response: NextResponse.json({
      error: 'plan_required',
      message: 'メールシーケンスは Lite 以上のプランでご利用いただけます。',
    }, { status: 403 }) };
  }

  const { count, error: countError } = await createServiceClient()
    .from('hp_sequences').select('id', { count: 'exact', head: true })
    .eq('site_id', siteId).is('deleted_at', null);
  if (countError) return { response: NextResponse.json({ error: '本数を確認できませんでした' }, { status: 503 }) };
  if ((count ?? 0) >= limit) {
    return { response: NextResponse.json({
      error: 'limit_reached',
      message: `このプランで作成できるメールシーケンスは${limit}件までです。`,
    }, { status: 403 }) };
  }
  return {};
}

function output(row: DbSequence, count = 0): SequenceRecord {
  return { id: row.id, name: row.name, trigger: row.trigger, steps: row.steps, active: row.active, enrolledCount: count, createdAt: row.created_at };
}

export async function GET(req: Request) {
  let siteId: string;
  try { siteId = sequenceSiteId(new URL(req.url).searchParams.get('siteId')); }
  catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }
  const auth = await owner(siteId);
  if (auth.response) return auth.response;
  const service = createServiceClient();
  const { data, error } = await service.from('hp_sequences').select('id,name,trigger,steps,active,created_at').eq('site_id', siteId).is('deleted_at', null).order('created_at');
  if (error) return NextResponse.json({ error: 'ステップ配信の準備が完了していません' }, { status: 503 });
  const rows = (data || []) as DbSequence[];
  const counts = new Map<string, number>();
  if (rows.length) {
    const { data: enrollments, error: countError } = await service.from('hp_sequence_enrollments').select('sequence_id').eq('site_id', siteId).in('state', ['queued', 'processing']);
    if (countError) return NextResponse.json({ error: '登録数を読み込めませんでした' }, { status: 500 });
    for (const item of enrollments || []) counts.set(item.sequence_id, (counts.get(item.sequence_id) || 0) + 1);
  }
  return NextResponse.json({ sequences: rows.map(row => output(row, counts.get(row.id) || 0)) });
}

export async function POST(req: Request) {
  let input;
  try { input = parseSequenceCreate(await readSequenceBody(req)); }
  catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }
  const auth = await owner(input.siteId);
  if (auth.response) return auth.response;
  const quota = await sequenceQuota(auth.db!, auth.user!.id, auth.user!.email, input.siteId);
  if (quota.response) return quota.response;
  const { data, error } = await createServiceClient().from('hp_sequences').insert({
    id: input.id, site_id: input.siteId, user_id: auth.user!.id, name: input.name, trigger: input.trigger, steps: input.steps, active: false,
  }).select('id,name,trigger,steps,active,created_at').single();
  if (error || !data) return NextResponse.json({ error: 'シーケンスを保存できませんでした' }, { status: 500 });
  return NextResponse.json({ sequence: output(data as DbSequence) });
}

export async function PATCH(req: Request) {
  const url = new URL(req.url);
  let siteId: string, id: string, updates;
  try {
    siteId = sequenceSiteId(url.searchParams.get('siteId'));
    id = sequenceId(url.searchParams.get('sequenceId'));
    updates = parseSequencePatch(await readSequenceBody(req));
  } catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }
  const auth = await owner(siteId);
  if (auth.response) return auth.response;
  const service = createServiceClient();
  if (Object.keys(updates).length === 1 && updates.active !== undefined) {
    const { data: result, error: rpcError } = await service.rpc('laruhp_sequence_set_active', {
      p_site: siteId, p_owner: auth.user!.id, p_sequence: id, p_active: updates.active,
    });
    if (rpcError) return NextResponse.json({ error: '更新できませんでした' }, { status: 500 });
    if (!(result as { ok?: boolean } | null)?.ok) return NextResponse.json({ error: 'シーケンスが見つかりません' }, { status: 404 });
    const { data: row, error: readError } = await service.from('hp_sequences').select('id,name,trigger,steps,active,created_at')
      .eq('site_id', siteId).eq('id', id).single();
    if (readError || !row) return NextResponse.json({ error: '更新結果を確認できませんでした' }, { status: 500 });
    return NextResponse.json({ sequence: output(row as DbSequence) });
  }
  const { data, error } = await service.from('hp_sequences').update({ ...updates, updated_at: new Date().toISOString() })
    .eq('site_id', siteId).eq('id', id).eq('user_id', auth.user!.id).is('deleted_at', null).select('id,name,trigger,steps,active,created_at');
  if (error) return NextResponse.json({ error: '更新できませんでした' }, { status: 500 });
  if (data?.length !== 1) return NextResponse.json({ error: 'シーケンスが見つかりません' }, { status: 404 });
  return NextResponse.json({ sequence: output(data[0] as DbSequence) });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  let siteId: string, id: string;
  try { siteId = sequenceSiteId(url.searchParams.get('siteId')); id = sequenceId(url.searchParams.get('sequenceId')); }
  catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }
  const auth = await owner(siteId);
  if (auth.response) return auth.response;
  const { data, error } = await createServiceClient().rpc('laruhp_sequence_delete', {
    p_site: siteId, p_owner: auth.user!.id, p_sequence: id,
  });
  if (error) return NextResponse.json({ error: '削除できませんでした' }, { status: 500 });
  if (!(data as { ok?: boolean } | null)?.ok) return NextResponse.json({ error: 'シーケンスが見つかりません' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
