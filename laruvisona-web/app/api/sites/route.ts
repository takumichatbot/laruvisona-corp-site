import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/sites — list user's sites
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('sites')
    .select('id, name, slug, industry, published, created_at, updated_at, view_count, custom_domain, settings_json')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sites: data });
}

// POST /api/sites — create new site
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { name, industry, blocks_json, seo_json, settings_json } = body;

  // Generate unique slug from name
  const baseSlug = (name || 'my-site')
    .toLowerCase()
    .replace(/[^a-z0-9ぁ-ん一-龯]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 30);
  const slug = `${baseSlug}-${Date.now().toString(36)}`;

  const { data, error } = await supabase
    .from('sites')
    .insert({
      user_id: user.id,
      name: name || 'マイサイト',
      slug,
      industry: industry || null,
      blocks_json: blocks_json || [],
      seo_json: seo_json || { title: '', description: '', keywords: '', ogTitle: '', ogDescription: '', ogImage: '' },
      settings_json: settings_json || {},
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ site: data }, { status: 201 });
}
