import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

async function currentUser() {
  const auth = await createClient();
  const result = await auth.auth.getUser();
  return result.data.user;
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const result = await createServiceClient().from('profiles').select('digest_enabled').eq('id', user.id).maybeSingle();
  if (result.error || !result.data) return NextResponse.json({ error: '設定を取得できません' }, { status: 503 });
  return NextResponse.json({ enabled: result.data.digest_enabled !== false });
}

export async function PATCH(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (typeof body?.enabled !== 'boolean') return NextResponse.json({ error: 'Invalid enabled' }, { status: 400 });
  const result = await createServiceClient().from('profiles')
    .update({ digest_enabled: body.enabled }).eq('id', user.id).select('id');
  if (result.error || result.data?.length !== 1) return NextResponse.json({ error: '設定を保存できません' }, { status: 503 });
  return NextResponse.json({ enabled: body.enabled });
}
