import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function verifyOwner(supabase: Awaited<ReturnType<typeof createClient>>, postId: string, userId: string) {
  const { data } = await supabase
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

  const { postId } = await params;
  const post = await verifyOwner(supabase, postId, user.id);
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data } = await supabase.from('news_posts').select('*').eq('id', postId).single();
  return NextResponse.json({ post: data });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ postId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { postId } = await params;
  const post = await verifyOwner(supabase, postId, user.id);
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updates = await req.json() as Record<string, unknown>;
  const { data, error } = await supabase.from('news_posts').update(updates).eq('id', postId).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ post: data });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ postId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { postId } = await params;
  const post = await verifyOwner(supabase, postId, user.id);
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await supabase.from('news_posts').delete().eq('id', postId);
  return NextResponse.json({ ok: true });
}
