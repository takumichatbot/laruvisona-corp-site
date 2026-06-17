import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: siteId } = await params;

  // Public endpoint — no auth required for published sites
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('news_posts')
    .select('id, title, category, published_at, image_url')
    .eq('site_id', siteId)
    .eq('published', true)
    .order('published_at', { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ posts: data || [] });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: siteId } = await params;

  // Verify ownership
  const { data: site } = await supabase.from('sites').select('id').eq('id', siteId).eq('user_id', user.id).single();
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { title, content, category, image_url, published, published_at } = await req.json() as {
    title: string; content?: string; category?: string; image_url?: string; published?: boolean; published_at?: string;
  };

  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 });

  const { data, error } = await supabase.from('news_posts').insert({
    site_id: siteId,
    title,
    content: content || null,
    category: category || null,
    image_url: image_url || null,
    published: published ?? false,
    published_at: published_at || new Date().toISOString(),
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ post: data });
}
