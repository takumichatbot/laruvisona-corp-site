import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ domain: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { domain } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from('sites')
    .select('name, seo_json')
    .eq('custom_domain', domain)
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

export default async function SiteByDomainPage({ params }: Props) {
  const { domain } = await params;
  const supabase = await createClient();

  const { data: site } = await supabase
    .from('sites')
    .select('published_html, name, settings_json')
    .eq('custom_domain', domain)
    .eq('published', true)
    .single();

  if (!site?.published_html) notFound();

  // Fire-and-forget view count increment
  void supabase.rpc('increment_view_count_by_domain', { site_domain: domain });

  const settings = (site.settings_json ?? {}) as {
    larubotPublicId?: string;
    laruseoPublicId?: string;
    gaTrackingId?: string;
    clarityId?: string;
  };
  const { larubotPublicId, laruseoPublicId, gaTrackingId, clarityId } = settings;

  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: site.published_html }} style={{ minHeight: '100vh' }} />
      {gaTrackingId && (
        <>
          <script async src={`https://www.googletagmanager.com/gtag/js?id=${gaTrackingId}`} />
          <script dangerouslySetInnerHTML={{ __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${gaTrackingId}')` }} />
        </>
      )}
      {clarityId && (
        <script dangerouslySetInnerHTML={{ __html: `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window,document,"clarity","script","${clarityId}")` }} />
      )}
      {larubotPublicId && (
        <script src="https://larubot.tokyo/static/embed.js" data-public-id={larubotPublicId} defer />
      )}
      {laruseoPublicId && (
        <script src="https://larubot.tokyo/embed/blog.js" data-id={laruseoPublicId} data-limit="6" defer />
      )}
    </>
  );
}

export const dynamic = 'force-dynamic';
