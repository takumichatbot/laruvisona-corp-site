import { createServiceClient } from '@/lib/supabase/server';
import { canonicalBase, decodeSlug, isHostForSite } from '@/lib/public-site-url';
import { blogPublicId } from '@/lib/larubot-public-id';
import { ownerLaruEntitlement } from '@/lib/hp-owner-entitlement';
import { loadPublishedPresentation } from '@/lib/published-presentation';
import { normalizeDesign, type SiteDesign } from '@/lib/site-design';

/**
 * 記事ページ・サイトマップで使う「このサイトの LARU SEO の記事を出してよいか」。
 * 公開ページで blog.js を出す条件（app/hp/[slug]/page.tsx）と同じ：
 *   公開中のサイト・このホストで配信してよい・持ち主の今の契約に LARU SEO が含まれる・設定で切っていない・public_id がある
 */
export interface ArticleSite {
  id: string;
  slug: string;
  base: string;
  publicId: string;
  siteName: string;
  noIndex: boolean;
  design: SiteDesign | null;
  fontFamily: string;
}

export async function loadArticleSite(rawSlug: string, host: string | null): Promise<ArticleSite | null> {
  const slug = decodeSlug(rawSlug);
  if (!slug) return null;
  const supabase = createServiceClient();
  const { data: site } = await supabase
    .from('sites')
    .select('id, name, slug, custom_domain, published, published_html, blocks_json, seo_json, settings_json, industry, user_id')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle();
  if (!site || !site.published_html) return null;
  if (!isHostForSite(site, host)) return null;
  const settings = (site.settings_json ?? {}) as Record<string, unknown>;
  const publicId = blogPublicId(settings as { laruseoPublicId?: string; larubotPublicId?: string });
  if (!publicId || settings.laruseo === false) return null;
  const laru = await ownerLaruEntitlement(supabase, (site.user_id as string | null) ?? null);
  if (!laru.seo) return null;
  const pub = await loadPublishedPresentation(supabase, site);
  return {
    id: String(site.id),
    slug: String(site.slug),
    base: canonicalBase(site),
    publicId,
    siteName: pub.siteName || String(site.name || ''),
    noIndex: settings.noIndex === true,
    design: settings.design ? normalizeDesign(settings.design) : null,
    fontFamily: typeof settings.fontFamily === 'string' ? settings.fontFamily : '',
  };
}
