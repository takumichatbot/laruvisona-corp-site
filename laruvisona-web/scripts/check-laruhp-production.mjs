import process from 'node:process';

const origin = new URL(process.env.LARUHP_ORIGIN || 'https://laruhp.com').origin;
const failures = [];
const checked = new Map();

function decodeHtml(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

function firstMatch(html, pattern) {
  const match = html.match(pattern);
  return match ? decodeHtml(match[1].trim()) : '';
}

function absolute(value, base) {
  try {
    const url = new URL(value, base);
    url.hash = '';
    return url;
  } catch {
    return null;
  }
}

function addFailure(url, message) {
  failures.push(`${url}: ${message}`);
}

async function fetchPage(url) {
  const key = url.href;
  if (checked.has(key)) return checked.get(key);
  const promise = fetch(url, {
    redirect: 'manual',
    headers: { 'user-agent': 'LARUHP-Production-Check/1.0' },
  }).then(async response => ({ response, body: await response.text() }));
  checked.set(key, promise);
  return promise;
}

const sitemapUrl = new URL('/sitemap.xml', origin);
const sitemapResponse = await fetch(sitemapUrl, { redirect: 'error' });
if (!sitemapResponse.ok) throw new Error(`sitemap.xml を取得できません (${sitemapResponse.status})`);
const sitemap = await sitemapResponse.text();
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
  .map(match => absolute(decodeHtml(match[1]), origin))
  .filter(Boolean);

if (sitemapUrls.length === 0) throw new Error('sitemap.xml にURLがありません');
if (sitemapUrls.some(url => url.origin !== origin)) throw new Error('sitemap.xml に別ホストのURLがあります');

const internalUrls = new Map(sitemapUrls.map(url => [url.href, url]));
for (const url of sitemapUrls) {
  const { response, body } = await fetchPage(url);
  if (response.status !== 200) {
    addFailure(url.href, `HTTP ${response.status}`);
    continue;
  }
  if (!response.headers.get('strict-transport-security')) addFailure(url.href, 'HSTSがありません');
  if (response.headers.get('x-content-type-options') !== 'nosniff') addFailure(url.href, 'X-Content-Type-Optionsが不正です');
  if (!response.headers.get('referrer-policy')) addFailure(url.href, 'Referrer-Policyがありません');

  const title = firstMatch(body, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const description = firstMatch(body, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i)
    || firstMatch(body, /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["'][^>]*>/i);
  const canonical = firstMatch(body, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i)
    || firstMatch(body, /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["'][^>]*>/i);
  const ogImage = firstMatch(body, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i)
    || firstMatch(body, /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/i);
  const robots = firstMatch(body, /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)["'][^>]*>/i);

  if (!title) addFailure(url.href, 'titleがありません');
  if (!description) addFailure(url.href, 'descriptionがありません');
  const canonicalUrl = absolute(canonical, url);
  if (!canonicalUrl || canonicalUrl.href !== url.href) addFailure(url.href, `canonicalが一致しません (${canonical || 'なし'})`);
  const ogImageUrl = absolute(ogImage, url);
  if (!ogImageUrl || ogImageUrl.origin !== origin) addFailure(url.href, `og:imageが同一ホストにありません (${ogImage || 'なし'})`);
  if (/noindex/i.test(robots)) addFailure(url.href, 'sitemap掲載ページがnoindexです');

  for (const match of body.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi)) {
    const linked = absolute(decodeHtml(match[1]), url);
    if (!linked || linked.origin !== origin) continue;
    if (!['http:', 'https:'].includes(linked.protocol)) continue;
    internalUrls.set(linked.href, linked);
  }
}

for (const url of internalUrls.values()) {
  const { response } = await fetchPage(url);
  if (response.status >= 400) addFailure(url.href, `内部リンクがHTTP ${response.status}`);
}

if (failures.length) {
  console.error(`LARU HP 本番検査: ${failures.length}件の不一致`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`LARU HP 本番検査: OK（sitemap ${sitemapUrls.length}ページ、内部URL ${internalUrls.size}件）`);
}
