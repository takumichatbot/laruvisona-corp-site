import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { exportToHTML, EXPORT_VERSION } from '@/lib/html-export';
import type { Page, SEOSettings, SiteSettings } from '@/types/laruHP';
import { redact, logError, safeErrorMessage } from '@/lib/api-error';
import { sha256 } from '@/lib/content-hash';
import { verifySharedSecret } from '@/lib/shared-secret';
import { readContactBody } from '@/lib/contact-contract';
import { republishSource, type VersionRow } from '@/lib/republish-source';

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
//
// 作り直す元は「公開時点の中身」（site_versions のいちばん新しい版）。下書き（blocks_json 等）
// からは作らない。下書きに未公開の変更があるサイトは書かずに skipped として返す
// （判定は lib/republish-source.ts）。以前は下書きから作り直していたため、公開していない
// 文章や設定が、利用者の操作なしに公開側へ出ていた。
export async function POST(req: Request) {
  const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const secretOk = verifySharedSecret(bearer, process.env.ADMIN_SECRET);

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

  let input: Record<string, unknown>;
  try { input = await readContactBody(req, 16_384); }
  catch { return NextResponse.json({ error: '入力を確認してください' }, { status: 400 }); }
  const { onlyOutdated, slug, limit, dryRun, includeBefore } = input as
    { onlyOutdated?: boolean; slug?: string; limit?: number; dryRun?: boolean; includeBefore?: boolean };
  if ((slug != null && (typeof slug !== 'string' || slug.length > 160))
    || (limit != null && (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > 500))
    || (onlyOutdated != null && typeof onlyOutdated !== 'boolean')
    || (dryRun != null && typeof dryRun !== 'boolean')
    || (includeBefore != null && typeof includeBefore !== 'boolean')) {
    return NextResponse.json({ error: '入力を確認してください' }, { status: 400 });
  }
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

  if (error) return NextResponse.json({ error: safeErrorMessage(error, '処理できませんでした') }, { status: 500 });

  /** 公開時点の中身（いちばん新しい版）。読めなければ作り直さない */
  const latestVersion = async (siteId: string): Promise<{ row: VersionRow; error: boolean }> => {
    const { data, error: vError } = await service
      .from('site_versions')
      .select('blocks_json, seo_json, settings_json, created_at')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false })
      .limit(1);
    return { row: vError ? null : (data?.[0] ?? null), error: !!vError };
  };
  const sourceOf = async (site: NonNullable<typeof sites>[number]) => {
    const v = await latestVersion(site.id);
    if (v.error) return { ok: false as const, reason: 'snapshot_unreadable' as const };
    return republishSource(site, v.row);
  };

  // 書かずに、何が対象になるかだけ返す。
  // いまの中身の指紋も返すので、あとで「変わったかどうか」を見比べられる。
  if (dryRun) {
    const targets = [];
    for (const s of sites ?? []) {
      const src = await sourceOf(s);
      targets.push({
        id: s.id, slug: s.slug, name: s.name,
        current_sha256: sha256(String(s.published_html ?? '')),
        current_bytes: String(s.published_html ?? '').length,
        outdated: !String(s.published_html ?? '').includes(`<!--lhpv:${EXPORT_VERSION}-->`),
        // 実行したときに作り直すか。'regenerate' 以外は書かない（理由）
        plan: src.ok ? 'regenerate' : src.reason,
      });
    }
    return NextResponse.json({
      version: EXPORT_VERSION,
      dryRun: true,
      total: targets.length,
      regenerate: targets.filter(t => t.plan === 'regenerate').length,
      targets,
    });
  }

  const results: { id: string; slug: string | null; ok: boolean; status: string; error?: string }[] = [];
  /** この回が書いた分を、書く前へ戻すための記録 */
  const undoSites: { id: string; slug: string | null; published_html?: string; before_sha256: string; expected_sha256: string }[] = [];

  for (const site of sites ?? []) {
    try {
      // 公開時点の中身で作り直す。未公開の変更があるサイトは書かない
      const src = await sourceOf(site);
      if (!src.ok) {
        results.push({ id: site.id, slug: site.slug, ok: true, status: `skipped_${src.reason}` });
        continue;
      }
      const rawBlocks = src.blocks;
      const seoSettings: SEOSettings = src.seo;
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
        src.settings as SiteSettings,
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
    /* 未公開の変更がある・公開時点の版が無い等で、書かなかったサイト。
       公開HTMLは今のまま。利用者が次に公開したときに、今の書き出しで作られる。 */
    skipped: results.filter(r => r.status.startsWith('skipped_')),
    failed,
    /* この応答をファイルに保存しておくと、
       POST /api/admin/published-html-backup へそのまま送り返すだけで、
       **この回が書いた分だけ**が書く前へ戻る。
       そのあと利用者が公開し直した行は、競合として止まる。 */
    undo: { version: EXPORT_VERSION, ranAt: new Date().toISOString(), sites: undoSites },
  });
}
