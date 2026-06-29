import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// 投稿の所有者（= サイトのowner）が userId と一致するか検証（service roleで確実に読む）
async function verifyOwner(service: ReturnType<typeof admin>, postId: string, userId: string) {
  const { data } = await service
    .from('news_posts')
    .select('id, site_id, sites!inner(user_id)')
    .eq('id', postId)
    .single();
  return data && (data.sites as unknown as { user_id: string }).user_id === userId ? data : null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ postId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = admin();
  const { postId } = await params;
  if (!(await verifyOwner(service, postId, user.id))) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data } = await service.from('news_posts').select('*').eq('id', postId).single();
  return NextResponse.json({ post: data });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ postId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = admin();
  const { postId } = await params;
  if (!(await verifyOwner(service, postId, user.id))) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updates = await req.json() as Record<string, unknown>;
  // 改ざん防止: 主要キーは更新不可
  delete updates.id; delete updates.site_id; delete updates.user_id; delete updates.created_at;
  updates.updated_at = new Date().toISOString();

  const { data, error } = await service.from('news_posts').update(updates).eq('id', postId).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ post: data });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ postId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = admin();
  const { postId } = await params;
  if (!(await verifyOwner(service, postId, user.id))) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await service.from('news_posts').delete().eq('id', postId);
  return NextResponse.json({ ok: true });
}
