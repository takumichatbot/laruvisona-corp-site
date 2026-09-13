import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { readSequenceBody, sequenceId, sequenceSiteId } from '@/lib/sequence-contract';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  let body, siteId: string, id: string, contactId: string;
  try {
    body = await readSequenceBody(req, 10_000);
    siteId = sequenceSiteId(body.siteId);
    id = sequenceId(body.sequenceId);
    if (typeof body.contactId !== 'string' || !UUID.test(body.contactId)) throw Error('顧客を確認してください');
    contactId = body.contactId;
  } catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }

  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });
  const { data: site, error } = await db.from('sites').select('id').eq('id', siteId).eq('user_id', user.id).single();
  if (error || !site) return NextResponse.json({ error: 'サイトが見つかりません' }, { status: 404 });
  const { data, error: enrollError } = await createServiceClient().rpc('laruhp_sequence_enroll_specific', {
    p_contact: contactId, p_site: siteId, p_sequence: id,
  });
  if (enrollError) return NextResponse.json({ error: '顧客を登録できませんでした' }, { status: 500 });
  if (!(data as { enrolled?: boolean } | null)?.enrolled) return NextResponse.json({ error: 'この顧客は登録済みです' }, { status: 409 });
  return NextResponse.json({ ok: true });
}
