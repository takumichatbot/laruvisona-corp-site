import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from('sites')
    .select('name, seo_json')
    .eq('slug', slug)
    .eq('published', true)
    .single();

  if (!data) return { title: 'Not Found' };
  const seo = data.seo_json as { title?: string; description?: string; ogTitle?: string; ogDescription?: string; ogImage?: string };
  const ogTitle = seo.ogTitle || seo.title || data.name;
  const ogDesc = seo.ogDescription || seo.description || '';
  const ogImage = seo.ogImage || `https://laruvisona.com/og-default.png`;

  return {
    title: seo.title || data.name,
    description: seo.description || '',
    openGraph: {
      title: ogTitle,
      description: ogDesc,
      images: [{ url: ogImage, width: 1200, height: 630, alt: ogTitle }],
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description: ogDesc,
      images: [ogImage],
    },
  };
}

export default async function PublishedSitePage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: site } = await supabase
    .from('sites')
    .select('published_html, name')
    .eq('slug', slug)
    .eq('published', true)
    .single();

  if (!site || !site.published_html) {
    notFound();
  }

  // Fire-and-forget view count increment (uses security definer RPC, no auth needed)
  void supabase.rpc('increment_view_count', { site_slug: slug });

  return (
    <div
      dangerouslySetInnerHTML={{ __html: site.published_html }}
      style={{ minHeight: '100vh' }}
    />
  );
}

export const dynamic = 'force-dynamic';
