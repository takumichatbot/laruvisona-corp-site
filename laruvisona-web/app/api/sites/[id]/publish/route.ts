import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { exportToHTML } from '@/lib/html-export';
import type { Block, Page, SEOSettings, SiteSettings } from '@/types/laruHP';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { data: site, error: fetchError } = await supabase
    .from('sites')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (fetchError || !site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  // Handle both v1 (Block[]) and v2 ({ v: 2, pages: Page[] }) formats
  const rawBlocks = site.blocks_json as Block[] | { v: number; pages: Page[] };
  let blocks: Block[];
  let seoSettings: SEOSettings = site.seo_json as SEOSettings;

  if (Array.isArray(rawBlocks)) {
    blocks = rawBlocks;
  } else if (rawBlocks?.v === 2 && rawBlocks.pages?.length) {
    blocks = rawBlocks.pages[0].blocks;
    seoSettings = rawBlocks.pages[0].seo || seoSettings;
  } else {
    blocks = [];
  }

  const html = exportToHTML(
    blocks,
    seoSettings,
    site.settings_json as SiteSettings,
    site.name,
    { name: site.name, industry: site.industry ?? undefined }
  );

  const { data: updated, error: updateError } = await supabase
    .from('sites')
    .update({ published: true, published_html: html })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('slug')
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({
    success: true,
    slug: updated.slug,
    url: `/hp/${updated.slug}`,
  });
}

// Unpublish
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { error } = await supabase
    .from('sites')
    .update({ published: false, published_html: null })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
