import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { exportToHTML, EXPORT_VERSION } from '@/lib/html-export';
import type { Block, Page, SEOSettings, SiteSettings } from '@/types/laruHP';
import { redact, logError } from '@/lib/api-error';

// 公開サイトの published_html を、いまの html-export で作り直す。
//
// これは**データベースを書き換える処理**である。生成物は行に残るので、
// コードを戻しただけでは表示は戻らない。だから、
//   ・起動時に自動で走らせない（REPUBLISH_ON_BOOT を明示したときだけ）
//   ・走らせる前に、いまの published_html を控えておく
//     （GET /api/admin/published-html-backup → 保存 → 戻すときは POST で書き戻す）
//   ・まず1件、次に少数、と範囲を絞れるようにする
// という順で扱う。手順は docs/rebuild-migration-2026-09-11.md にある。
//
// 認証: 管理者セッション、またはサーバー内部からの Bearer ADMIN_SECRET。
// body:
//   { onlyOutdated?: boolean } EXPORT_VERSION が古いものだけ
//   { slug?: string }          そのサイトだけ
//   { limit?: number }         先頭から件数を絞る（少しずつ出すとき）
//   { dryRun?: boolean }       書かずに、対象だけ返す
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

  const { onlyOutdated, slug, limit, dryRun } = await req.json().catch(() => ({})) as
    { onlyOutdated?: boolean; slug?: string; limit?: number; dryRun?: boolean };

  const service = await createServiceClient();
  let query = service
    .from('sites')
    .select('id, name, slug, industry, blocks_json, seo_json, settings_json')
    .eq('published', true);
  if (typeof slug === 'string' && slug) query = query.eq('slug', slug);
  if (onlyOutdated) {
    query = query.not('published_html', 'like', `%<!--lhpv:${EXPORT_VERSION}-->%`);
  }
  if (typeof limit === 'number' && limit > 0) query = query.limit(Math.floor(limit));
  const { data: sites, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 書かずに、何が対象になるかだけ返す
  if (dryRun) {
    return NextResponse.json({
      version: EXPORT_VERSION,
      dryRun: true,
      total: (sites ?? []).length,
      targets: (sites ?? []).map(s => ({ id: s.id, slug: s.slug, name: s.name })),
    });
  }

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
      logError('admin/republish-all', e);
      results.push({ id: site.id, slug: site.slug, ok: false, error: redact(e instanceof Error ? e.message : String(e)).slice(0, 300) });
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
