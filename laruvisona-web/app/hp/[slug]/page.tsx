import { createClient as createServiceClient } from '@supabase/supabase-js';
import { jsonForScript, safeToken } from '@/lib/safe-markup';
import { analyticsTrackingScript,signAnalyticsSite } from '@/lib/analytics-contract';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { canonicalBase, isHostForSite, decodeSlug } from '@/lib/public-site-url';
import { buildJsonLd, type BusinessInfo } from '@/lib/site-jsonld';
import { chatPublicId, blogPublicId } from '@/lib/larubot-public-id';
import type { Metadata } from 'next';
import PublishedSite from '@/components/PublishedSite';
import { applyTranslationToHtml, isTranslationLocale, translationFor, TRANSLATION_LOCALES } from '@/lib/translate-apply';

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
  /* ?lang=en のように言語を指定して開ける。保存してある翻訳をあてる。 */
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const query = (await searchParams) ?? {};
  const lang = Array.isArray(query.lang) ? query.lang[0] : query.lang;
  const slug = decodeSlug(rawSlug);
  const supabase = getServiceClient();
  const { data } = await supabase
    .from('sites')
    .select('name, seo_json, settings_json, slug, custom_domain')
    .eq('slug', slug)
    .eq('published', true)
    .single();

  if (!data) return { title: 'Not Found' };

  const seo = (data.seo_json ?? {}) as { title?: string; description?: string; ogTitle?: string; ogDescription?: string; ogImage?: string };
  const settings = (data.settings_json ?? {}) as { noIndex?: boolean; translations?: Record<string, { map?: Record<string, string> }> };
  const translated = isTranslationLocale(lang) ? translationFor(settings as Record<string, unknown>, lang) : null;
  // 同じサイトがパス形式・サブドメイン形式・独自ドメイン形式で開ける。
  // 開かれたホストに合わせて、そのサイトの正規URLを1つに決める。
  // 正規URLは保存された公開先の方針から一意に決める（入口のホストで変えない）
  const canonical = canonicalBase(data as { slug?: string | null; custom_domain?: string | null });
  const ogTitle = seo.ogTitle || seo.title || data.name;
  const ogDesc = seo.ogDescription || seo.description || '';

  // 用意してある言語を検索側へ伝える。翻訳済みのページは、その言語のURLを正規とする。
  const locales = Object.keys((settings.translations ?? {})).filter(isTranslationLocale);
  const languages = locales.length
    ? Object.fromEntries([
        ['ja', canonical],
        ...locales.map(code => [TRANSLATION_LOCALES[code].hreflang, `${canonical}?lang=${code}`]),
      ])
    : undefined;

  const metadata: Metadata = {
    title: translated?.map?.[seo.title || data.name] || seo.title || data.name,
    description: (seo.description && translated?.map?.[seo.description]) || seo.description || '',
    alternates: {
      canonical: translated && isTranslationLocale(lang) ? `${canonical}?lang=${lang}` : canonical,
      ...(languages ? { languages } : {}),
    },
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


export default async function PublishedSitePage({ params, searchParams }: Props) {
  const { slug: rawSlug } = await params;
  const query = (await searchParams) ?? {};
  const langParam = Array.isArray(query.lang) ? query.lang[0] : query.lang;
  const slug = decodeSlug(rawSlug);
  const supabase = getServiceClient();

  const { data: site } = await supabase
    .from('sites')
    .select('published_html, name, settings_json, seo_json, slug, custom_domain, industry')
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
    larubot?: boolean;
    laruseo?: boolean;
    gaTrackingId?: string;
    clarityId?: string;
    popups?: Array<{ enabled: boolean }>;
    businessInfo?: BusinessInfo;
  };
  const { gaTrackingId, clarityId } = settings;
  /*
    チャットとブログの設置タグは、**ここだけが出す。**

    以前は、公開HTML（lib/html-export.ts が焼き込む）とここの両方が
    出していた。公開HTMLの中の script は配信時に本物へ作り直して実行される
    （components/PublishedSite.tsx）ので、**両方が動いていた。**
      ・ブログの記事一覧が二重に描かれる
      ・チャットの窓が二重に立ち上がりうる

    判定も食い違っていた。あちらは
      ・chatPublicId / blogPublicId（片方が空なら、もう片方から補う）
      ・settings.larubot / settings.laruseo の入切を見る
    こちらは生の laruseoPublicId だけを見ていたので、
      ・チャットの識別子しか入っていない人には**何も出ない**
      ・LARUSEOを「切」にしても、識別子があれば**出し続ける**
    同じ規則に揃える。
  */
  const chatId = settings.larubot === false ? '' : chatPublicId(settings);
  const blogId = settings.laruseo === false ? '' : blogPublicId(settings);
  const hasActivePopup = (settings.popups || []).some(p => p.enabled);

  // 署名鍵が用意できないときは、計測だけ諦める（顧客の公開サイトは出す）。
  let analyticsToken = '';
  try { analyticsToken = signAnalyticsSite(slug); }
  catch { console.error('[hp] アクセス計測の署名鍵が使えないため、計測を止めて表示します'); }

  const seo = (site.seo_json ?? {}) as { description?: string };

  // このホストでこのサイトを配信してよいか。
  // proxy がホストから slug を決めていても、内部パス /hp/<slug> を
  // 直接指定されれば別サイトを指せる。表示側でも必ず確認する。
  const host = (await headers()).get('host');
  if (!isHostForSite(site as { slug?: string | null; custom_domain?: string | null }, host)) notFound();

  const base = canonicalBase(site as { slug?: string | null; custom_domain?: string | null });

  // ?lang= が指定され、その言語の翻訳が保存してあれば、本文にあてる。
  // 無い言語・壊れた指定は、そのまま日本語で出す（404にはしない）。
  const translation = isTranslationLocale(langParam)
    ? translationFor(site.settings_json as Record<string, unknown>, langParam)
    : null;
  const localizedHtml = translation
    ? applyTranslationToHtml(site.published_html, translation.map)
    : site.published_html;

  // Ensure the first <img> in the page is eager-loaded (improves LCP)
  /*
    公開済みのHTMLに焼き込まれている古い設置タグを、配信時に落とす。

    この直しより前に公開した人のHTMLには、まだ焼き込みが入っている。
    上で出すぶんと合わせて二重に動くので、そこだけ取り除く
    （larubot の2本だけを名指しする。他の script には触らない）。
    公開し直せば焼き込み自体が無くなるが、それを待たない。
  */
  const withoutBakedEmbeds = localizedHtml.replace(
    /<script[^>]*src="https:\/\/larubot\.tokyo\/(?:static\/embed|embed\/blog)\.js"[^>]*><\/script>/g,
    '',
  );

  const eagerHtml = withoutBakedEmbeds.replace(/<img\s/, '<img fetchpriority="high" loading="eager" ');

  /*
    businessInfo が無くても出す。

    以前は「入れてある人にだけ出す」だったが、公開HTML側にも別のものが
    あったので、入れていない人にも最低限のものが出ていた。
    こちらへ寄せた以上、ここで出さないと**構造化データが丸ごと無くなる。**
  */
  const jsonLdStr = buildJsonLd(site.name, base, seo, settings.businessInfo ?? ({} as BusinessInfo), site.industry);

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
      {chatId && (
        <script src="https://larubot.tokyo/static/embed.js" data-public-id={chatId} defer />
      )}
      {blogId && (
        <script src="https://larubot.tokyo/embed/blog.js" data-id={blogId} data-limit="6" defer />
      )}
      {/* Signed first-party pageview and heatmap tracking.
          署名鍵が無い・短いときは analytics_unavailable を投げる作りなので、
          そのままだと顧客の公開サイトが丸ごと500になる。落とすべきなのは
          アクセス計測だけで、顧客のサイトではない。計測を諦めて本文を出す。 */}
      {analyticsToken && (
        <script dangerouslySetInnerHTML={{ __html: analyticsTrackingScript(slug,analyticsToken) }} />
      )}
      {/* Popup */}
      {hasActivePopup && (
        <script src={`/api/popup?slug=${slug}`} defer />
      )}
    </>
  );
}

// ISR: cache 1 hour, bust on publish via revalidateTag('site-${slug}')
export const revalidate = 3600;
