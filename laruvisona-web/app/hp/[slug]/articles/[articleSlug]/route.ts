import { loadArticleSite } from '@/lib/hp-article-site';
import { articleIndexing, articleUrl, getContent, listContent, resolveMoved, targetState } from '@/lib/hp-seo-content';
import { articlePageHtml, statusPageHtml } from '@/lib/hp-article-html';
import { htmlResponse, redirectResponse } from '@/lib/hp-article-response';
import { isValidSlug } from '@/lib/laruseo-articles';

// LARU SEO の記事本文（顧客サイトの /articles/<slug>）。サーバーで完成した HTML を返す。
//   200 本文 ／ 301 slug の変更（最後の行き先へ1回で）／ 404 無い・取り消し・別サイトが正規 ／ 410 削除 ／ 503 LARU SEO に届かない
// 仕様: LARUbot_homepage docs/integrations/laru_hp_seo_article_contract.md（M03）
export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ slug: string; articleSlug: string }> }) {
  const { slug, articleSlug: rawArticle } = await params;
  let articleSlug = rawArticle;
  try { articleSlug = decodeURIComponent(rawArticle); } catch { /* そのまま */ }
  if (!isValidSlug(articleSlug)) return htmlResponse(req, statusPageHtml(404, null), 404);
  const site = await loadArticleSite(slug, req.headers.get('host'));
  if (!site) return htmlResponse(req, statusPageHtml(404, null), 404);

  const r = await getContent(site.publicId, articleSlug);
  if (r.kind === 'unavailable') return htmlResponse(req, statusPageHtml(503, site), 503);
  if (r.kind === 'gone') return htmlResponse(req, statusPageHtml(410, site), 410);
  if (r.kind === 'not_found') return htmlResponse(req, statusPageHtml(404, site), 404);
  if (r.kind === 'moved') {
    const final = await resolveMoved(site.publicId, articleSlug);
    return final ? redirectResponse(articleUrl(site.base, final)) : htmlResponse(req, statusPageHtml(404, site), 404);
  }
  const state = targetState(r.publication, site.base);
  // 同じ public_id の別サイトが正規の公開先として登録されている → このサイトでは出さない（同じ記事を複数サイトで出さない）
  if (state === 'elsewhere') return htmlResponse(req, statusPageHtml(404, null), 404);
  const { index, canonical } = articleIndexing({ state, siteNoIndex: site.noIndex, siteBase: site.base, article: r.article });
  const list = await listContent(site.publicId, { page: 1, limit: 6 });
  const html = articlePageHtml({ site, article: r.article, canonical, index, related: list.ok ? list.items : [] });
  return htmlResponse(req, html);
}
