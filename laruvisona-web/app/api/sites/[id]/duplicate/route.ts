import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { data: original } = await supabase
    .from('sites')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!original) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const slug = `${original.slug || 'site'}-copy-${Date.now().toString(36)}`;

  const { data: newSite, error } = await supabase
    .from('sites')
    .insert({
      user_id: user.id,
      name: `${original.name} (コピー)`,
      slug,
      industry: original.industry,
      blocks_json: original.blocks_json,
      settings_json: original.settings_json,
      seo_json: original.seo_json,
      published: false,
      published_html: null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ site: newSite });
}
