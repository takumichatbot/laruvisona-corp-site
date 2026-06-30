import { createClient as createServiceClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import { revalidateTag } from 'next/cache';
import type { Metadata } from 'next';
import PublishedSite from '@/components/PublishedSite';

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
    .select('name, seo_json, settings_json')
    .eq('slug', slug)
    .eq('published', true)
    .single();

  if (!data) return { title: 'Not Found' };

  const seo = (data.seo_json ?? {}) as { title?: string; description?: string; ogTitle?: string; ogDescription?: string; ogImage?: string };
  const settings = (data.settings_json ?? {}) as { noIndex?: boolean };
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://laruvisona.jp';
  const canonical = `${base}/hp/${slug}`;
  const ogTitle = seo.ogTitle || seo.title || data.name;
  const ogDesc = seo.ogDescription || seo.description || '';

  const metadata: Metadata = {
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
      // If ogImage is explicitly set in builder, use it; otherwise opengraph-image.tsx handles it
      ...(seo.ogImage ? { images: [{ url: seo.ogImage, width: 1200, height: 630, alt: ogTitle }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description: ogDesc,
      ...(seo.ogImage ? { images: [seo.ogImage] } : {}),
    },
  };

  return metadata;
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

function buildJsonLd(siteName: string, slug: string, seo: { description?: string }, bi: BusinessInfo): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://laruvisona.jp';
  const url = `${base}/hp/${slug}`;
  const schemaType = bi.type || 'LocalBusiness';
  const name = bi.name || siteName;

  const obj: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': schemaType,
    name,
    url,
  };

  if (bi.description || seo.description) obj.description = bi.description || seo.description;
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
    obj.geo = {
      '@type': 'GeoCoordinates',
      latitude: bi.latitude,
      longitude: bi.longitude,
    };
  }

  if (bi.openingHours?.length) {
    obj.openingHours = bi.openingHours;
  }

  if (bi.sameAs?.length) {
    obj.sameAs = bi.sameAs.filter(Boolean);
  }

  return JSON.stringify(obj);
}

export default async function PublishedSitePage({ params }: Props) {
  const { slug } = await params;
  const supabase = getServiceClient();

  const { data: site } = await supabase
    .from('sites')
    .select('published_html, name, settings_json, seo_json')
    .eq('slug', slug)
    .eq('published', true)
    .single();

  if (!site || !site.published_html) {
    notFound();
  }

  // ページビューは ISR キャッシュ下では再生成時しか走らず過少カウントになるため、
  // クライアント側ビーコン（下部の script）で訪問ごとに /api/pageview へ記録する。

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

  // Ensure the first <img> in the page is eager-loaded (improves LCP)
  const eagerHtml = site.published_html.replace(/<img\s/, '<img fetchpriority="high" loading="eager" ');

  const hasBusinessInfo = !!settings.businessInfo;
  const jsonLdStr = hasBusinessInfo
    ? buildJsonLd(site.name, slug, seo, settings.businessInfo!)
    : null;

  return (
    <>
      <PublishedSite html={eagerHtml} style={{ minHeight: '100vh' }} />
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
      {/* Pageview tracking（ISR下でも訪問ごとに記録）*/}
      <script dangerouslySetInnerHTML={{ __html: `fetch('/api/pageview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug:'${slug}'}),keepalive:true}).catch(function(){});` }} />
      {/* Heatmap tracking */}
      <script dangerouslySetInnerHTML={{ __html: `(function(){var S='${slug}',P='/api/heatmap?slug='+S,Q=[];function flush(){if(!Q.length)return;fetch(P,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Q),keepalive:true});Q=[];}document.addEventListener('click',function(e){Q.push({type:'click',x:e.clientX,y:e.clientY,path:location.pathname,viewport:{w:innerWidth,h:innerHeight}});});window.addEventListener('scroll',function(){var d=Math.round((scrollY/(document.body.scrollHeight-innerHeight||1))*100);Q.push({type:'scroll',scrollDepth:d,path:location.pathname,viewport:{w:innerWidth,h:innerHeight}});},{passive:true});window.addEventListener('beforeunload',flush);setInterval(flush,30000);})()` }} />
      {/* Popup */}
      {hasActivePopup && (
        <script src={`/api/popup?slug=${slug}`} defer />
      )}
    </>
  );
}

// ISR: cache 1 hour, bust on publish via revalidateTag('site-${slug}')
export const revalidate = 3600;
