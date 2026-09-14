import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { exportToHTML } from '@/lib/html-export';
import type { Block, Page, SEOSettings, SiteSettings } from '@/types/laruHP';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  // Paywall: require active subscription to publish
  // 管理者はバイパス（ダッシュボードは管理者を「有効」表示するため、ここも揃えないと
  // 契約済み表示なのにプラン選択モーダルが出る不整合が起きる）
  const adminEmails = [process.env.ADMIN_EMAIL, process.env.NEXT_PUBLIC_ADMIN_EMAIL]
    .filter(Boolean).join(',')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  const isAdmin = adminEmails.includes((user.email || '').toLowerCase());

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status')
    .eq('id', user.id)
    .single();

  if (!isAdmin && profile?.subscription_status !== 'active') {
    return NextResponse.json(
      { error: 'subscription_required', message: 'サイトの公開にはサブスクリプションが必要です' },
      { status: 403 }
    );
  }

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
  let pages: Page[];
  const seoSettings: SEOSettings = site.seo_json as SEOSettings;

  if (Array.isArray(rawBlocks)) {
    pages = [{ id: 'page-main', name: 'トップページ', path: '/', blocks: rawBlocks, seo: seoSettings }];
  } else if (rawBlocks?.v === 2 && rawBlocks.pages?.length) {
    pages = rawBlocks.pages;
  } else {
    pages = [{ id: 'page-main', name: 'トップページ', path: '/', blocks: [], seo: seoSettings }];
  }

  const html = exportToHTML(
    pages,
    seoSettings,
    site.settings_json as SiteSettings,
    site.name,
    { name: site.name, industry: site.industry ?? undefined, siteId: site.id, slug: site.slug ?? undefined }
  );

  const service = createServiceClient();
  const { data: updated, error: updateError } = await service
    .from('sites')
    .update({ published: true, published_html: html })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('slug')
    .single();

  if (updateError || !updated) return NextResponse.json({ error: 'サイトを公開できませんでした' }, { status: 500 });

  // Bust ISR cache for this slug
  if (updated?.slug) revalidatePath(`/hp/${updated.slug}`);

  // Save version snapshot (fire-and-forget)
  void service.from('site_versions').insert({
    site_id: id,
    label: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
    blocks_json: site.blocks_json,
    seo_json: site.seo_json,
    settings_json: site.settings_json,
  });

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
  const { data: owned } = await supabase.from('sites').select('id').eq('id', id).eq('user_id', user.id).maybeSingle();
  if (!owned) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  const { data: unpublished, error } = await createServiceClient()
    .from('sites')
    .update({ published: false, published_html: null })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id')
    .maybeSingle();

  if (error || !unpublished) return NextResponse.json({ error: 'サイトを非公開にできませんでした' }, { status: 500 });
  return NextResponse.json({ success: true });
}
