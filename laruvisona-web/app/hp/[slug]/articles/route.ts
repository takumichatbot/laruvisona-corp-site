import { loadArticleSite } from '@/lib/hp-article-site';
import { listContent, targetState } from '@/lib/hp-seo-content';
import { listPageHtml, statusPageHtml } from '@/lib/hp-article-html';
import { htmlResponse } from '@/lib/hp-article-response';

// LARU SEO の記事一覧（顧客サイトの /articles）。サーバーで完成した HTML を返す。
// 仕様: LARUbot_homepage docs/integrations/laru_hp_seo_article_contract.md（M03）
export const dynamic = 'force-dynamic';
const PER_PAGE = 20;

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site = await loadArticleSite(slug, req.headers.get('host'));
  if (!site) return htmlResponse(req, statusPageHtml(404, null), 404);
  const raw = new URL(req.url).searchParams.get('page');
  const page = raw && /^[1-9]\d{0,3}$/.test(raw) ? Number(raw) : 1;
  // ?page=1・壊れた値は正規の一覧へ寄せない（同じ中身を出し、canonical は 1 ページ目）
  const list = await listContent(site.publicId, { page, limit: PER_PAGE });
  if (!list.ok) return list.reason === 'not_found' ? htmlResponse(req, statusPageHtml(404, site), 404) : htmlResponse(req, statusPageHtml(503, site), 503);
  const state = targetState(list.publication, site.base);
  if (state === 'elsewhere') return htmlResponse(req, statusPageHtml(404, null), 404);
  if (page > 1 && !list.items.length) return htmlResponse(req, statusPageHtml(404, site), 404);
  const index = state === 'here' && !site.noIndex;
  return htmlResponse(req, listPageHtml({ site, items: list.items, page, hasNext: list.hasNext, index }));
}
