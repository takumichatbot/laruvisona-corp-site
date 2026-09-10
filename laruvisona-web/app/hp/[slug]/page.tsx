import { createClient as createServiceClient } from '@supabase/supabase-js';
import { jsonForScript, safeToken } from '@/lib/safe-markup';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { canonicalBase, isHostForSite } from '@/lib/public-site-url';
import type { Metadata } from 'next';
import PublishedSite from '@/components/PublishedSite';

// 注: 以前ここで revalidateTag を再エクスポートしていたが、
// Next.js のページは決められた export しか持てないため、
// 本番用ビルドの型検査で失敗していた。
// 再検証が必要な箇所は next/cache から直接 import する。

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
    .select('name, seo_json, settings_json, slug, custom_domain')
    .eq('slug', slug)
    .eq('published', true)
    .single();

  if (!data) return { title: 'Not Found' };

  const seo = (data.seo_json ?? {}) as { title?: string; description?: string; ogTitle?: string; ogDescription?: string; ogImage?: string };
  const settings = (data.settings_json ?? {}) as { noIndex?: boolean };
  // 同じサイトがパス形式・サブドメイン形式・独自ドメイン形式で開ける。
  // 開かれたホストに合わせて、そのサイトの正規URLを1つに決める。
  // 正規URLは保存された公開先の方針から一意に決める（入口のホストで変えない）
  const canonical = canonicalBase(data as { slug?: string | null; custom_domain?: string | null });
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

function buildJsonLd(siteName: string, baseUrl: string, seo: { description?: string }, bi: BusinessInfo): string {
  const url = baseUrl;
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

  return jsonForScript(obj);
}

export default async function PublishedSitePage({ params }: Props) {
  const { slug } = await params;
  const supabase = getServiceClient();

  const { data: site } = await supabase
    .from('sites')
    .select('published_html, name, settings_json, seo_json, slug, custom_domain')
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

  // このホストでこのサイトを配信してよいか。
  // proxy がホストから slug を決めていても、内部パス /hp/<slug> を
  // 直接指定されれば別サイトを指せる。表示側でも必ず確認する。
  const host = (await headers()).get('host');
  if (!isHostForSite(site as { slug?: string | null; custom_domain?: string | null }, host)) notFound();

  const base = canonicalBase(site as { slug?: string | null; custom_domain?: string | null });

  // Ensure the first <img> in the page is eager-loaded (improves LCP)
  const eagerHtml = site.published_html.replace(/<img\s/, '<img fetchpriority="high" loading="eager" ');

  const hasBusinessInfo = !!settings.businessInfo;
  const jsonLdStr = hasBusinessInfo
    ? buildJsonLd(site.name, base, seo, settings.businessInfo!)
    : null;

  return (
    <>
      <PublishedSite html={eagerHtml} style={{ minHeight: '100vh' }} />
      {jsonLdStr && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdStr }} />
      )}
      {gaTrackingId && (
        <>
          <script async src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(safeToken(gaTrackingId))}`} />
          <script dangerouslySetInnerHTML={{ __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config',${jsonForScript(safeToken(gaTrackingId))})` }} />
        </>
      )}
      {clarityId && (
        <script dangerouslySetInnerHTML={{ __html: `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window,document,"clarity","script",${jsonForScript(safeToken(clarityId))})` }} />
      )}
      {larubotPublicId && (
        <script src="https://larubot.tokyo/static/embed.js" data-public-id={larubotPublicId} defer />
      )}
      {laruseoPublicId && (
        <script src="https://larubot.tokyo/embed/blog.js" data-id={laruseoPublicId} data-limit="6" defer />
      )}
      {/* Pageview tracking（ISR下でも訪問ごとに記録）*/}
      <script dangerouslySetInnerHTML={{ __html: `fetch('/api/pageview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug:${jsonForScript(slug)}}),keepalive:true}).catch(function(){});` }} />
      {/* Heatmap tracking */}
      <script dangerouslySetInnerHTML={{ __html: `(function(){var S=${jsonForScript(slug)},P='/api/heatmap?slug='+encodeURIComponent(S),Q=[];function flush(){if(!Q.length)return;fetch(P,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Q),keepalive:true});Q=[];}document.addEventListener('click',function(e){Q.push({type:'click',x:e.clientX,y:e.clientY,path:location.pathname,viewport:{w:innerWidth,h:innerHeight}});});window.addEventListener('scroll',function(){var d=Math.round((scrollY/(document.body.scrollHeight-innerHeight||1))*100);Q.push({type:'scroll',scrollDepth:d,path:location.pathname,viewport:{w:innerWidth,h:innerHeight}});},{passive:true});window.addEventListener('beforeunload',flush);setInterval(flush,30000);})()` }} />
      {/* Popup */}
      {hasActivePopup && (
        <script src={`/api/popup?slug=${slug}`} defer />
      )}
    </>
  );
}

// ISR: cache 1 hour, bust on publish via revalidateTag('site-${slug}')
export const revalidate = 3600;
