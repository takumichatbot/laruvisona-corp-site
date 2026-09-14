import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { readNewsPost, validNewsId } from '@/lib/news-post-contract';

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// 投稿の所有者（= サイトのowner）が userId と一致するか検証（service roleで確実に読む）
async function verifyOwner(service: ReturnType<typeof admin>, postId: string, userId: string) {
  const { data, error } = await service
    .from('news_posts')
    .select('id, site_id, sites!inner(user_id)')
    .eq('id', postId)
    .single();
  if (error && (error as { code?: string }).code !== 'PGRST116') throw new Error('post owner unavailable');
  return data && (data.sites as unknown as { user_id: string }).user_id === userId ? data : null;
}

async function ownedOrResponse(service: ReturnType<typeof admin>, postId: string, userId: string) {
  try {
    return { owned: await verifyOwner(service, postId, userId), response: null };
  } catch {
    return { owned: null, response: NextResponse.json({ error: '記事を確認できませんでした' }, { status: 503 }) };
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ postId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = admin();
  const { postId } = await params;
  if (!validNewsId(postId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const ownership = await ownedOrResponse(service, postId, user.id);
  if (ownership.response) return ownership.response;
  if (!ownership.owned) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data, error } = await service.from('news_posts').select('*').eq('id', postId).single();
  if (error || !data) return NextResponse.json({ error: '記事を取得できませんでした' }, { status: 503 });
  return NextResponse.json({ post: data });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ postId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = admin();
  const { postId } = await params;
  if (!validNewsId(postId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const ownership = await ownedOrResponse(service, postId, user.id);
  if (ownership.response) return ownership.response;
  if (!ownership.owned) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let updates;
  try { updates = await readNewsPost(req, false); }
  catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }

  const { data, error } = await service.from('news_posts')
    .update({ ...updates, updated_at: new Date().toISOString() }).eq('id', postId).select().single();
  if (error) return NextResponse.json({ error: '記事を保存できませんでした' }, { status: 503 });
  return NextResponse.json({ post: data });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ postId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = admin();
  const { postId } = await params;
  if (!validNewsId(postId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const ownership = await ownedOrResponse(service, postId, user.id);
  if (ownership.response) return ownership.response;
  if (!ownership.owned) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data, error } = await service.from('news_posts').delete().eq('id', postId).select('id');
  if (error) return NextResponse.json({ error: '記事を削除できませんでした' }, { status: 503 });
  if (data?.length !== 1) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
