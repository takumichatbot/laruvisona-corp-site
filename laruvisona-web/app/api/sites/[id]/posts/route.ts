import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { readNewsPost, validNewsId } from '@/lib/news-post-contract';

// 書き込み・管理用は service role（RLSバイパス）。所有権はアプリ側で検証する。
function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: siteId } = await params;
  if (!validNewsId(siteId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const all = new URL(req.url).searchParams.get('all') === 'true';
  const service = admin();

  // ?all=true: 管理画面用（下書き含む全件・全カラム）。要ログイン＋所有権。
  if (all) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: site } = await service.from('sites').select('id').eq('id', siteId).eq('user_id', user.id).single();
    if (!site) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { data, error } = await service
      .from('news_posts')
      .select('*')
      .eq('site_id', siteId)
      .order('published_at', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ posts: data || [] });
  }

  // 公開: 公開済みのみ（newsブロック等）。
  const { data: publicSite, error: siteError } = await service
    .from('sites').select('id').eq('id', siteId).eq('published', true).maybeSingle();
  if (siteError) return NextResponse.json({ error: '記事を読み込めませんでした' }, { status: 503 });
  if (!publicSite) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { data, error } = await service
    .from('news_posts')
    .select('id, title, category, published_at, image_url')
    .eq('site_id', siteId)
    .eq('published', true)
    .order('published_at', { ascending: false })
    .limit(20);
  if (error) return NextResponse.json({ error: '記事を読み込めませんでした' }, { status: 503 });
  return NextResponse.json({ posts: data || [] });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: siteId } = await params;
  if (!validNewsId(siteId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const service = admin();

  // 所有権検証（service roleで確実に）
  const { data: site } = await service.from('sites').select('id').eq('id', siteId).eq('user_id', user.id).single();
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let input;
  try { input = await readNewsPost(req, true); }
  catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }

  // INSERT は service role（RLSバイパス）。user_id も設定。
  const { data, error } = await service.from('news_posts').insert({
    site_id: siteId,
    user_id: user.id,
    ...input,
    published: input.published ?? false,
    published_at: input.published_at || new Date().toISOString(),
  }).select().single();

  if (error) return NextResponse.json({ error: '記事を保存できませんでした' }, { status: 503 });
  return NextResponse.json({ post: data });
}
