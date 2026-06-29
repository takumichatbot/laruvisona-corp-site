import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/server';
import { renderMarkdown, plainExcerpt } from '@/lib/markdown';

export const revalidate = 300; // ISR: 5分

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

async function getPost(postId: string) {
  const supabase = createServiceClient();
  const { data: post } = await supabase
    .from('news_posts')
    .select('id, site_id, title, content, category, image_url, published, published_at')
    .eq('id', postId)
    .eq('published', true)
    .single<PostRow>();
  if (!post) return null;
  const { data: site } = await supabase
    .from('sites')
    .select('name, slug, published')
    .eq('id', post.site_id)
    .single<{ name: string; slug: string | null; published: boolean }>();
  if (!site || !site.published) return null;
  return { post, site };
}

export async function generateMetadata({ params }: { params: Promise<{ postId: string }> }): Promise<Metadata> {
  const { postId } = await params;
  const data = await getPost(postId);
  if (!data) return { title: '記事が見つかりません' };
  const { post, site } = data;
  const description = plainExcerpt(post.content, 120);
  return {
    title: `${post.title}${site.name ? ` | ${site.name}` : ''}`,
    description,
    openGraph: {
      title: post.title,
      description,
      type: 'article',
      publishedTime: post.published_at,
      images: post.image_url ? [post.image_url] : [],
    },
  };
}

export default async function PostPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  const data = await getPost(postId);
  if (!data) notFound();
  const { post, site } = data;

  const html = renderMarkdown(post.content || '');
  const dateStr = new Date(post.published_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
  const backHref = site.slug ? `/hp/${site.slug}` : '/';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    datePublished: post.published_at,
    dateModified: post.published_at,
    ...(post.image_url ? { image: post.image_url } : {}),
    ...(site.name ? { author: { '@type': 'Organization', name: site.name }, publisher: { '@type': 'Organization', name: site.name } } : {}),
  };

  return (
    <main style={{ background: '#fff', minHeight: '100vh', color: '#1f2937' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Header */}
      <header style={{ borderBottom: '1px solid #f1f5f9', padding: '16px 24px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <Link href={backHref} style={{ color: '#64748b', textDecoration: 'none', fontSize: 14, fontWeight: 700 }}>
            ← {site.name || 'サイト'}へ戻る
          </Link>
        </div>
      </header>

      <article style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px 64px' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
          {post.category && (
            <span style={{ background: '#eff6ff', color: '#2563eb', fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 999 }}>{post.category}</span>
          )}
          <time style={{ color: '#94a3b8', fontSize: 13 }}>{dateStr}</time>
        </div>

        <h1 style={{ fontSize: '2rem', fontWeight: 900, lineHeight: 1.35, margin: '0 0 24px' }}>{post.title}</h1>

        {post.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.image_url} alt={post.title} style={{ width: '100%', height: 'auto', borderRadius: 16, marginBottom: 28 }} />
        )}

        <div style={{ fontSize: '1rem', color: '#374151' }} dangerouslySetInnerHTML={{ __html: html }} />

        <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
          <Link href={backHref} style={{ display: 'inline-block', background: '#1e293b', color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: 14, padding: '12px 28px', borderRadius: 10 }}>
            {site.name || 'サイト'}へ戻る
          </Link>
        </div>
      </article>
    </main>
  );
}
