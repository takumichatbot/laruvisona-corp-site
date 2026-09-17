import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getArticle, listArticles, isValidSlug } from '@/lib/laruseo-articles';
import { jsonForScript } from '@/lib/safe-markup';
import { BlogHeader, BlogFooter, formatDate } from '../chrome';
import '../article.css';

/**
 * 記事1本のページ。
 *
 * これが無かったので、記事は**1本も**こちらのURLを持っていなかった。
 * 一覧を向こうの script で描いていたため、押した先は larubot.tokyo だった。
 * つまり、書いた記事の評価は全部よそのドメインに乗っていた。
 *
 * 本文は向こうが作ったHTMLなので、**必ず sanitizeArticleHtml を通す**
 * （lib/laruseo-articles.ts の getArticle がやる）。
 * ここで生のHTMLを触らないこと。
 */

const BASE = 'https://laruvisona.jp';

export const revalidate = 600;
// 一覧に載っていない slug でも、その場で取りに行って出す。
export const dynamicParams = true;

export async function generateStaticParams() {
  const { articles } = await listArticles({ limit: 50 });
  return articles.map(a => ({ slug: a.slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) return { title: '記事が見つかりません | 株式会社LaruVisona', robots: { index: false, follow: false } };

  const url = `${BASE}/blog/${article.slug}`;
  return {
    title: `${article.title} | 株式会社LaruVisona`,
    description: article.description || undefined,
    alternates: { canonical: url },
    openGraph: {
      title: article.title,
      description: article.description || undefined,
      url,
      siteName: '株式会社LaruVisona',
      type: 'article',
      locale: 'ja_JP',
      ...(article.publishedAt ? { publishedTime: article.publishedAt } : {}),
      ...(article.updatedAt ? { modifiedTime: article.updatedAt } : {}),
      ...(article.thumbnailUrl ? { images: [{ url: article.thumbnailUrl }] } : {}),
    },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isValidSlug(slug)) notFound();

  const article = await getArticle(slug);
  if (!article) notFound();

  const url = `${BASE}/blog/${article.slug}`;

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: article.title,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    url,
    ...(article.description ? { description: article.description } : {}),
    ...(article.thumbnailUrl ? { image: article.thumbnailUrl } : {}),
    ...(article.publishedAt ? { datePublished: article.publishedAt } : {}),
    ...(article.updatedAt ? { dateModified: article.updatedAt } : {}),
    author: { '@type': 'Organization', name: '株式会社LaruVisona', url: BASE },
    publisher: { '@type': 'Organization', name: '株式会社LaruVisona', url: BASE },
  };

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'ホーム', item: BASE },
      { '@type': 'ListItem', position: 2, name: 'ブログ', item: `${BASE}/blog` },
      { '@type': 'ListItem', position: 3, name: article.title, item: url },
    ],
  };

  return (
    <div className="min-h-screen bg-[#030712] text-white">
      <BlogHeader />

      <main className="px-6 pt-12 pb-24">
        <article className="max-w-3xl mx-auto">
          <nav aria-label="パンくず" className="mb-8 text-xs text-slate-500">
            <Link href="/" className="hover:text-slate-300 transition-colors">ホーム</Link>
            <span className="mx-2">/</span>
            <Link href="/blog" className="hover:text-slate-300 transition-colors">ブログ</Link>
          </nav>

          <header className="mb-10">
            <h1 className="text-2xl md:text-4xl font-bold leading-tight tracking-tight mb-4">{article.title}</h1>
            <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-500">
              {article.publishedAt && (
                <time dateTime={article.publishedAt}>公開 {formatDate(article.publishedAt)}</time>
              )}
              {article.updatedAt && article.updatedAt !== article.publishedAt && (
                <time dateTime={article.updatedAt}>更新 {formatDate(article.updatedAt)}</time>
              )}
            </div>
          </header>

          {article.thumbnailUrl && (
            <img
              src={article.thumbnailUrl}
              alt=""
              className="mb-10 w-full rounded-2xl border border-white/10 object-cover"
              loading="lazy"
              decoding="async"
            />
          )}

          {/* 本文。getArticle が除菌済みの文字列だけを返す。 */}
          <div className="article-body" dangerouslySetInnerHTML={{ __html: article.html }} />

          <div className="mt-16 rounded-2xl border border-white/10 bg-white/[0.04] p-6 sm:p-8">
            <p className="text-white font-bold text-base mb-2">ご相談はいつでもどうぞ</p>
            <p className="text-slate-400 text-sm leading-relaxed mb-5">
              業務システム・Webアプリの受託開発を承っています。まずは内容をお聞かせください。
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/contact" className="bg-white text-black px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-50 transition-all">
                お問い合わせ
              </Link>
              <Link href="/blog" className="border border-white/15 text-slate-300 px-5 py-2.5 rounded-xl font-bold text-sm hover:text-white hover:border-white/30 transition-all">
                記事一覧へ
              </Link>
            </div>
          </div>
        </article>
      </main>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonForScript(ld) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonForScript(breadcrumb) }} />

      <BlogFooter />
    </div>
  );
}
