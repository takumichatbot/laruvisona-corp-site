import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ domain: string }>;
}

interface BusinessInfo {
  type?: string;
  name?: string;
  description?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  phone?: string;
  priceRange?: string;
  openingHours?: string[];
  latitude?: string;
  longitude?: string;
  sameAs?: string[];
}

function buildJsonLd(siteName: string, domain: string, seoDesc: string | undefined, bi: BusinessInfo): string {
  const url = `https://${domain}`;
  const obj: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': bi.type || 'LocalBusiness',
    name: bi.name || siteName,
    url,
  };
  if (bi.description || seoDesc) obj.description = bi.description || seoDesc;
  if (bi.phone) obj.telephone = bi.phone;
  if (bi.priceRange) obj.priceRange = bi.priceRange;
  if (bi.address || bi.city || bi.postalCode) {
    obj.address = {
      '@type': 'PostalAddress',
      ...(bi.address ? { streetAddress: bi.address } : {}),
      ...(bi.city ? { addressLocality: bi.city } : {}),
      ...(bi.postalCode ? { postalCode: bi.postalCode } : {}),
      addressCountry: 'JP',
    };
  }
  if (bi.latitude && bi.longitude) {
    obj.geo = { '@type': 'GeoCoordinates', latitude: bi.latitude, longitude: bi.longitude };
  }
  if (bi.openingHours?.length) obj.openingHours = bi.openingHours;
  if (bi.sameAs?.length) obj.sameAs = bi.sameAs.filter(Boolean);
  return JSON.stringify(obj);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { domain } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from('sites')
    .select('name, seo_json, settings_json')
    .eq('custom_domain', domain)
    .eq('published', true)
    .single();

  if (!data) return { title: 'Not Found' };

  const seo = (data.seo_json ?? {}) as { title?: string; description?: string; ogTitle?: string; ogDescription?: string; ogImage?: string };
  const settings = (data.settings_json ?? {}) as { noIndex?: boolean };
  const canonical = `https://${domain}`;
  const ogTitle = seo.ogTitle || seo.title || data.name;
  const ogDesc = seo.ogDescription || seo.description || '';

  return {
    title: seo.title || data.name,
    description: seo.description || '',
    alternates: { canonical },
    robots: settings.noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
    openGraph: {
      title: ogTitle,
      description: ogDesc,
      url: canonical,
      type: 'website',
      ...(seo.ogImage ? { images: [{ url: seo.ogImage, width: 1200, height: 630, alt: ogTitle }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description: ogDesc,
      ...(seo.ogImage ? { images: [seo.ogImage] } : {}),
    },
  };
}

export default async function SiteByDomainPage({ params }: Props) {
  const { domain } = await params;
  const supabase = await createClient();

  const { data: site } = await supabase
    .from('sites')
    .select('published_html, name, settings_json, seo_json')
    .eq('custom_domain', domain)
    .eq('published', true)
    .single();

  if (!site?.published_html) notFound();

  void supabase.rpc('increment_view_count_by_domain', { site_domain: domain });

  const settings = (site.settings_json ?? {}) as {
    larubotPublicId?: string;
    laruseoPublicId?: string;
    gaTrackingId?: string;
    clarityId?: string;
    popups?: Array<{ enabled: boolean }>;
    businessInfo?: BusinessInfo;
  };
  const { larubotPublicId, laruseoPublicId, gaTrackingId, clarityId } = settings;
  const hasActivePopup = (settings.popups || []).some(p => p.enabled);

  const seo = (site.seo_json ?? {}) as { description?: string };
  const jsonLdStr = settings.businessInfo
    ? buildJsonLd(site.name, domain, seo.description, settings.businessInfo)
    : null;

  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: site.published_html }} style={{ minHeight: '100vh' }} />
      {jsonLdStr && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdStr }} />
      )}
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
      {/* Heatmap tracking */}
      <script dangerouslySetInnerHTML={{ __html: `(function(){var D='${domain}',P='/api/heatmap?domain='+D,Q=[];function flush(){if(!Q.length)return;fetch(P,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Q),keepalive:true});Q=[];}document.addEventListener('click',function(e){Q.push({type:'click',x:e.clientX,y:e.clientY,path:location.pathname,viewport:{w:innerWidth,h:innerHeight}});});window.addEventListener('scroll',function(){var d=Math.round((scrollY/(document.body.scrollHeight-innerHeight||1))*100);Q.push({type:'scroll',scrollDepth:d,path:location.pathname,viewport:{w:innerWidth,h:innerHeight}});},{passive:true});window.addEventListener('beforeunload',flush);setInterval(flush,30000);})()` }} />
      {hasActivePopup && (
        <script src={`/api/popup?domain=${domain}`} defer />
      )}
    </>
  );
}

export const dynamic = 'force-dynamic';
