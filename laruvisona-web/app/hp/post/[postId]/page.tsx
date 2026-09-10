import { notFound, permanentRedirect } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { canonicalBase, siteUrl } from '@/lib/public-site-url';

// 旧い記事URL（/hp/post/<id>）。
//
// 公開済みHTMLの中のリンク（lib/html-export.ts）はこの形を出しているので、
// 既存サイトのために残す。ただしここでは記事を表示せず、
// その記事が属するサイトの正規URLへ転送する。
//
// 記事IDだけで表示していたため、どのホストで開いても同じ内容が出て、
// 顧客のホスト上に別サイトの記事を出せる状態だった。
// 表示は /hp/<slug>/post/<id> に一本化する。

export const revalidate = 300;

export default async function LegacyPostRedirect(
  { params }: { params: Promise<{ postId: string }> },
) {
  const { postId } = await params;
  const supabase = createServiceClient();

  const { data: post } = await supabase
    .from('news_posts')
    .select('id, site_id, published')
    .eq('id', postId)
    .eq('published', true)
    .single<{ id: string; site_id: string; published: boolean }>();
  if (!post) notFound();

  const { data: site } = await supabase
    .from('sites')
    .select('slug, custom_domain, published')
    .eq('id', post.site_id)
    .eq('published', true)
    .single<{ slug: string | null; custom_domain: string | null; published: boolean }>();
  if (!site || !site.slug) notFound();

  // 転送先はその記事のサイトの正規URL。
  // ここでは開かれたホストを見ない（旧URLは会社ホストでしか使われず、
  // 顧客ホスト上の /hp/... は proxy が /hp/<slug>/hp/... に写さないため）。
  permanentRedirect(siteUrl(canonicalBase(site), `post/${post.id}`));
}
