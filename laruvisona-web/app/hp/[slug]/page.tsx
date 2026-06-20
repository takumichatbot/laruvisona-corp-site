import { createClient as createServiceClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import { revalidateTag } from 'next/cache';
import type { Metadata } from 'next';

// Re-exported so publish route can call it
export { revalidateTag };

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = getServiceClient();
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
  const supabase = getServiceClient();

  const { data: site } = await supabase
    .from('sites')
    .select('published_html, name, settings_json')
    .eq('slug', slug)
    .eq('published', true)
    .single();

  if (!site || !site.published_html) {
    notFound();
  }

  // Fire-and-forget view count increment
  void supabase.rpc('increment_view_count', { site_slug: slug });

  const settings = (site.settings_json ?? {}) as { larubotPublicId?: string; laruseoPublicId?: string };
  const larubotPublicId = settings.larubotPublicId;
  const laruseoPublicId = settings.laruseoPublicId;

  return (
    <>
      <div
        dangerouslySetInnerHTML={{ __html: site.published_html }}
        style={{ minHeight: '100vh' }}
      />
      {larubotPublicId && (
        <script src="https://larubot.tokyo/static/embed.js" data-public-id={larubotPublicId} defer />
      )}
      {laruseoPublicId && (
        <script src="https://larubot.tokyo/embed/blog.js" data-id={laruseoPublicId} data-limit="6" defer />
      )}
    </>
  );
}

// ISR: cache 1 hour, bust on publish via revalidateTag('site-${slug}')
export const revalidate = 3600;
