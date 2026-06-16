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
  const seo = data.seo_json as { title?: string; description?: string; ogTitle?: string; ogDescription?: string };

  return {
    title: seo.title || data.name,
    description: seo.description || '',
    openGraph: {
      title: seo.ogTitle || seo.title || data.name,
      description: seo.ogDescription || seo.description || '',
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

  return (
    <div
      dangerouslySetInnerHTML={{ __html: site.published_html }}
      style={{ minHeight: '100vh' }}
    />
  );
}

export const dynamic = 'force-dynamic';
