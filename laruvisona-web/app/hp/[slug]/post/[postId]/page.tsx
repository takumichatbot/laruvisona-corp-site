import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/server';
import { renderMarkdown, plainExcerpt } from '@/lib/markdown';
import { canonicalBase, siteLink, siteUrl, isHostForSite } from '@/lib/public-site-url';

// 顧客サイトの記事ページ。
//
// URLが指すサイトと、記事の site_id が一致することを必須にする。
// 記事IDだけで引くと、Aのホストに Bの記事IDを渡せば Bの内容が出てしまう。
// 記事・サイトの両方が公開済みであることも確認する。

export const revalidate = 300;

interface PostRow {
  id: string;
  site_id: string;
  title: string;
  content: string | null;
  category: string | null;
  image_url: string | null;
  published: boolean;
  published_at: string;
}

interface SiteRow {
  id: string;
  name: string;
  slug: string | null;
  custom_domain: string | null;
  published: boolean;
}

/** slug のサイトに属する、公開済みの記事だけを返す */
async function getSitePost(slug: string, postId: string) {
  const supabase = createServiceClient();

  const { data: site } = await supabase
    .from('sites')
    .select('id, name, slug, custom_domain, published')
    .eq('slug', slug)
    .eq('published', true)
    .single<SiteRow>();
  if (!site) return null;

  const { data: post } = await supabase
    .from('news_posts')
    .select('id, site_id, title, content, category, image_url, published, published_at')
    .eq('id', postId)
    .eq('site_id', site.id)      // ← 別サイトの記事IDでは引けない
    .eq('published', true)
    .single<PostRow>();
  if (!post) return null;

  return { post, site };
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string; postId: string }> },
): Promise<Metadata> {
  const { slug, postId } = await params;
  const data = await getSitePost(slug, postId);
  if (!data) return { title: '記事が見つかりません', robots: { index: false, follow: false } };

  const { post, site } = data;
  const canonical = siteUrl(canonicalBase(site), `post/${post.id}`);
  const description = plainExcerpt(post.content, 120);

  return {
    title: `${post.title}${site.name ? ` | ${site.name}` : ''}`,
    description,
    alternates: { canonical },
    openGraph: {
      title: post.title,
      description,
      url: canonical,
      type: 'article',
      publishedTime: post.published_at,
      images: post.image_url ? [post.image_url] : [],
    },
  };
}

export default async function SitePostPage(
  { params }: { params: Promise<{ slug: string; postId: string }> },
) {
  const { slug, postId } = await params;
  const data = await getSitePost(slug, postId);
  if (!data) notFound();

  const { post, site } = data;

  // 受け取ったホストが、このサイトを配信してよいホストか。
  // /hp/<別サイトのslug>/post/<id> を顧客ホストで開かせない。
  const host = (await headers()).get('host');
  if (!isHostForSite(site, host)) notFound();

  const base = canonicalBase(site);
  const canonical = siteUrl(base, `post/${post.id}`);
  // 戻るリンクは正規URLへの絶対URL。
  // 相対 '/' にすると、会社ホストで開いたときに会社トップへ戻ってしまう。
  const backHref = siteLink(site);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    datePublished: post.published_at,
    url: canonical,
    ...(post.image_url ? { image: post.image_url } : {}),
    publisher: { '@type': 'Organization', name: site.name, url: base },
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
  };

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <article className="mx-auto max-w-3xl px-5 py-10 md:py-16">
        <Link
          href={backHref}
          className="inline-flex items-center min-h-[44px] text-sm text-sky-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
        >
          ← {site.name} のトップへ
        </Link>

        {post.category && (
          <p className="mt-6 text-xs font-bold tracking-wide text-sky-700">{post.category}</p>
        )}
        <h1 className="mt-2 text-[26px] md:text-4xl font-bold leading-[1.35]">{post.title}</h1>
        <p className="mt-3 text-sm text-slate-500">
          <time dateTime={post.published_at}>
            {new Date(post.published_at).toLocaleDateString('ja-JP')}
          </time>
        </p>

        {post.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.image_url}
            alt=""
            className="mt-6 w-full rounded-2xl border border-slate-200"
            loading="lazy"
            decoding="async"
          />
        )}

        <div
          className="mt-8 prose prose-slate max-w-none"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(post.content || '') }}
        />

        <div className="mt-12 border-t border-slate-200 pt-6">
          <Link
            href={backHref}
            className="inline-flex items-center min-h-[44px] text-sm text-sky-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
          >
            ← {site.name} のトップへ
          </Link>
        </div>
      </article>
    </main>
  );
}
