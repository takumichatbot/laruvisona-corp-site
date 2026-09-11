import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { exportToHTML, EXPORT_VERSION } from '@/lib/html-export';
import type { Block, Page, SEOSettings, SiteSettings } from '@/types/laruHP';
import { redact, logError } from '@/lib/api-error';
import { sha256 } from '@/lib/content-hash';

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
//   { includeBefore?: boolean } 戻すための記録に、前の中身そのものを含める（既定 true）
//
// 応答には undo を付ける。これは「この回が書いた分だけを、書く前の姿へ戻す」ための
// 記録で、そのまま POST /api/admin/published-html-backup へ送り返せる形にしてある。
//   ・id ごとに、前の中身（published_html）と、**この回が書いた中身の指紋**
//     （expected_sha256）が入っている
//   ・戻す側は、いまの中身の指紋がそれと一致する行にだけ書く。
//     一致しない＝そのあと利用者が公開し直した行なので、競合として止まる
// 全件の控え（GET）をそのまま流し込むやり方は、対象外のサイトが後から
// 公開した内容まで巻き戻すので、標準の手順から外した。
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

  const { onlyOutdated, slug, limit, dryRun, includeBefore } = await req.json().catch(() => ({})) as
    { onlyOutdated?: boolean; slug?: string; limit?: number; dryRun?: boolean; includeBefore?: boolean };
  const keepBefore = includeBefore !== false;

  const service = await createServiceClient();
  let query = service
    .from('sites')
    .select('id, name, slug, industry, blocks_json, seo_json, settings_json, published_html, updated_at')
    .eq('published', true);
  if (typeof slug === 'string' && slug) query = query.eq('slug', slug);
  if (onlyOutdated) {
    query = query.not('published_html', 'like', `%<!--lhpv:${EXPORT_VERSION}-->%`);
  }
  if (typeof limit === 'number' && limit > 0) query = query.limit(Math.floor(limit));
  const { data: sites, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 書かずに、何が対象になるかだけ返す。
  // いまの中身の指紋も返すので、あとで「変わったかどうか」を見比べられる。
  if (dryRun) {
    return NextResponse.json({
      version: EXPORT_VERSION,
      dryRun: true,
      total: (sites ?? []).length,
      targets: (sites ?? []).map(s => ({
        id: s.id, slug: s.slug, name: s.name,
        current_sha256: sha256(String(s.published_html ?? '')),
        current_bytes: String(s.published_html ?? '').length,
        outdated: !String(s.published_html ?? '').includes(`<!--lhpv:${EXPORT_VERSION}-->`),
      })),
    });
  }

  const results: { id: string; slug: string | null; ok: boolean; status: string; error?: string }[] = [];
  /** この回が書いた分を、書く前へ戻すための記録 */
  const undoSites: { id: string; slug: string | null; published_html?: string; before_sha256: string; expected_sha256: string }[] = [];

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

      const before = String(site.published_html ?? '');

      /* 読んだときのままの行にだけ書く。
         読んでから書くまでのあいだに利用者が公開し直していたら、
         その内容を消してしまうので、書かずに競合として残す。 */
      const { data: updated, error: updateError } = await service
        .from('sites')
        .update({ published_html: html })
        .eq('id', site.id)
        .eq('updated_at', site.updated_at)
        .select('id');

      if (updateError) throw new Error(updateError.message);
      /* 更新は「errorが無い」だけでは成功と言えない。
         条件に合う行が無ければ0件のまま、errorにはならない。 */
      if (!updated || updated.length !== 1) {
        results.push({ id: site.id, slug: site.slug, ok: false, status: 'conflict' });
        continue;
      }

      if (site.slug) revalidatePath(`/hp/${site.slug}`);
      results.push({ id: site.id, slug: site.slug, ok: true, status: 'updated' });
      undoSites.push({
        id: site.id,
        slug: site.slug,
        ...(keepBefore ? { published_html: before } : {}),
        before_sha256: sha256(before),
        expected_sha256: sha256(html),   // この回が書いた中身の指紋
      });
    } catch (e) {
      logError('admin/republish-all', e);
      results.push({
        id: site.id, slug: site.slug, ok: false, status: 'failed',
        error: redact(e instanceof Error ? e.message : String(e)).slice(0, 300),
      });
    }
  }

  const failed = results.filter(r => !r.ok);
  return NextResponse.json({
    version: EXPORT_VERSION,
    ranAt: new Date().toISOString(),
    total: results.length,
    updated: results.filter(r => r.status === 'updated').length,
    conflicts: results.filter(r => r.status === 'conflict').length,
    failed,
    /* この応答をファイルに保存しておくと、
       POST /api/admin/published-html-backup へそのまま送り返すだけで、
       **この回が書いた分だけ**が書く前へ戻る。
       そのあと利用者が公開し直した行は、競合として止まる。 */
    undo: { version: EXPORT_VERSION, ranAt: new Date().toISOString(), sites: undoSites },
  });
}
