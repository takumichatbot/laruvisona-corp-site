import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/sites/[id]
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { data, error } = await supabase
    .from('sites')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ site: data });
}

// PUT /api/sites/[id]
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { name, blocks_json, seo_json, settings_json } = body;

  const { data, error } = await supabase
    .from('sites')
    .update({ name, blocks_json, seo_json, settings_json })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ site: data });
}

// PATCH /api/sites/[id] — partial update: slug or settings_patch
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  // settings_patch: merge into existing settings_json
  if (body.settings_patch !== undefined) {
    const { data: current } = await supabase.from('sites').select('settings_json').eq('id', id).eq('user_id', user.id).single();
    if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const merged = { ...(current.settings_json as Record<string, unknown> || {}), ...body.settings_patch };
    const { data, error } = await supabase.from('sites').update({ settings_json: merged }).eq('id', id).eq('user_id', user.id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ site: data });
  }

  const { slug } = body;
  if (!slug || !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug) || slug.length < 3 || slug.length > 60 || /--/.test(slug)) {
    return NextResponse.json({ error: 'slugは3〜60文字・英数字とハイフン（先頭末尾・連続ハイフン不可）' }, { status: 400 });
  }

  const { data: existing } = await supabase.from('sites').select('id').eq('slug', slug).neq('id', id).limit(1);
  if (existing && existing.length > 0) {
    return NextResponse.json({ error: 'このURLは既に使われています' }, { status: 409 });
  }

  const { data, error } = await supabase
    .from('sites')
    .update({ slug })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ site: data });
}

// DELETE /api/sites/[id]
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { error } = await supabase
    .from('sites')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
