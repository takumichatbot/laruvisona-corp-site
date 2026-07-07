import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { exportToHTML, EXPORT_VERSION } from '@/lib/html-export';
import type { Block, Page, SEOSettings, SiteSettings } from '@/types/laruHP';

// 全公開サイトの published_html を最新の html-export で一括再生成する。
// html-export.ts を修正した際、各オーナーの手動再公開を待たずに反映させるためのエンドポイント。
// 認証: 管理者セッション、またはサーバー内部からの Bearer ADMIN_SECRET（server.js の起動時自動実行用）。
// body: { onlyOutdated?: boolean } — true なら EXPORT_VERSION が古いサイトだけ再生成（起動時はこちら）。
export async function POST(req: Request) {
  const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const secretOk = !!process.env.ADMIN_SECRET && bearer === process.env.ADMIN_SECRET;

  if (!secretOk) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const adminEmails = [process.env.ADMIN_EMAIL, process.env.NEXT_PUBLIC_ADMIN_EMAIL]
      .filter(Boolean).join(',')
      .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    if (!user || !adminEmails.includes((user.email || '').toLowerCase())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const { onlyOutdated } = await req.json().catch(() => ({})) as { onlyOutdated?: boolean };

  const service = await createServiceClient();
  let query = service
    .from('sites')
    .select('id, name, slug, industry, blocks_json, seo_json, settings_json')
    .eq('published', true);
  if (onlyOutdated) {
    query = query.not('published_html', 'like', `%<!--lhpv:${EXPORT_VERSION}-->%`);
  }
  const { data: sites, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results: { id: string; slug: string | null; ok: boolean; error?: string }[] = [];

  for (const site of sites ?? []) {
    try {
      const rawBlocks = site.blocks_json as Block[] | { v: number; pages: Page[] };
      const seoSettings: SEOSettings = site.seo_json as SEOSettings;
      let pages: Page[];
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

      const { error: updateError } = await service
        .from('sites')
        .update({ published_html: html })
        .eq('id', site.id);

      if (updateError) throw new Error(updateError.message);
      if (site.slug) revalidatePath(`/hp/${site.slug}`);
      results.push({ id: site.id, slug: site.slug, ok: true });
    } catch (e) {
      results.push({ id: site.id, slug: site.slug, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }

  const failed = results.filter(r => !r.ok);
  return NextResponse.json({
    version: EXPORT_VERSION,
    total: results.length,
    updated: results.length - failed.length,
    failed,
  });
}
