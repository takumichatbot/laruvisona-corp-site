import process from 'node:process';

const origin = new URL(process.env.LARUHP_ORIGIN || 'https://laruhp.com').origin;
const apiOrigin = new URL(process.env.LARUHP_API_ORIGIN || 'https://laruvisona.jp').origin;
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
  const visibleText = body
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  const decorativeEmoji = [...new Set(visibleText.match(/\p{Extended_Pictographic}/gu) || [])]
    .filter(character => !['©', '®', '™'].includes(character));

  if (!title) addFailure(url.href, 'titleがありません');
  if (!description) addFailure(url.href, 'descriptionがありません');
  const canonicalUrl = absolute(canonical, url);
  if (!canonicalUrl || canonicalUrl.href !== url.href) addFailure(url.href, `canonicalが一致しません (${canonical || 'なし'})`);
  const ogImageUrl = absolute(ogImage, url);
  if (!ogImageUrl || ogImageUrl.origin !== origin) addFailure(url.href, `og:imageが同一ホストにありません (${ogImage || 'なし'})`);
  if (/noindex/i.test(robots)) addFailure(url.href, 'sitemap掲載ページがnoindexです');
  if (decorativeEmoji.length) addFailure(url.href, `本文に絵文字があります (${decorativeEmoji.join('')})`);

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

const contactUrl = new URL('/contact', origin);
const contact = await fetchPage(contactUrl);
if (!/https:\/\/larubot\.tokyo\/f\/[A-Za-z0-9-]+/.test(contact.body)) {
  addFailure(contactUrl.href, 'LARUbotの問い合わせフォームがありません');
}

// 管理画面を配信するアプリ側の Service Worker が、認証後のHTML・RSC・APIを
// Cache Storageへ残さないことを本番の実体で確認する。
const serviceWorkerUrl = new URL('/sw.js', apiOrigin);
const serviceWorkerResponse = await fetch(serviceWorkerUrl, {
  redirect: 'error',
  headers: { 'user-agent': 'LARUHP-Production-Check/1.0' },
});
const serviceWorker = await serviceWorkerResponse.text();
if (!serviceWorkerResponse.ok) {
  addFailure(serviceWorkerUrl.href, `Service Workerを取得できません (HTTP ${serviceWorkerResponse.status})`);
} else {
  const privacyRules = [
    [/const CACHE_NAME = 'laruhp-v6'/, '古い端末キャッシュを破棄する版ではありません'],
    [/function cacheableRequest\(request\)/, '保存対象を限定する関数がありません'],
    [/if \(!cacheableRequest\(e\.request\)\) return/, '保存対象外の通信を素通ししていません'],
    [/url\.pathname\.startsWith\('\/_next\/static\/'\)/, '静的資産だけを許可する規則がありません'],
  ];
  for (const [pattern, message] of privacyRules) {
    if (!pattern.test(serviceWorker)) addFailure(serviceWorkerUrl.href, message);
  }
}

// 認証や署名が必要な書き込み口を、値を渡さずに確認する。
// ここで成功応答が返ると、本番データを第三者が変更できる可能性がある。
const protectedWrites = [
  { path: '/api/admin/republish-all', expected: [401, 403] },
  { path: '/api/sequences/execute', expected: [401] },
  { path: '/api/digest/send', expected: [401] },
  { path: '/api/retention/send', expected: [401] },
  { path: '/api/cron/booking-payments', expected: [401] },
  { path: '/api/cron/booking-notifications', expected: [401] },
  { path: '/api/cron/booking-reminders', expected: [401] },
  { path: '/api/cron/shop-notifications', expected: [401] },
  { path: '/api/images/upload', expected: [401] },
  { path: '/api/stripe/webhook', expected: [400], headers: { 'stripe-signature': 'invalid' } },
  { path: '/api/stripe/scheduling-webhook', expected: [400], headers: { 'stripe-signature': 'invalid' } },
];
for (const item of protectedWrites) {
  const url = new URL(item.path, apiOrigin);
  const response = await fetch(url, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'user-agent': 'LARUHP-Production-Check/1.0', ...item.headers },
  });
  if (!item.expected.includes(response.status)) {
    addFailure(url.href, `未認証・不正署名を拒否しません (HTTP ${response.status})`);
  }
}

if (origin !== apiOrigin) {
  const publicApiUrl = new URL('/api/sequences/execute', origin);
  const response = await fetch(publicApiUrl, { method: 'POST', redirect: 'manual' });
  if (response.status !== 405) {
    addFailure(publicApiUrl.href, `公開ホストでAPIのPOSTが遮断されていません (HTTP ${response.status})`);
  }
}

// 本番ホストを検査するときは、移行前後の入口とクエリ保持も固定する。
if (origin === 'https://laruhp.com') {
  const redirectCases = [
    ['https://www.laruhp.com/domains?source=production-check', 'https://laruhp.com/domains?source=production-check'],
    ['https://laruvisona.jp/laruHP/domains?source=production-check', 'https://laruhp.com/domains?source=production-check'],
  ];
  for (const [from, expected] of redirectCases) {
    const response = await fetch(from, { redirect: 'manual' });
    const location = absolute(response.headers.get('location') || '', from);
    if (![301, 308].includes(response.status) || location?.href !== expected) {
      addFailure(from, `転送が不正です (HTTP ${response.status}, ${location?.href || 'Locationなし'})`);
    }
  }
}

if (failures.length) {
  console.error(`LARU HP 本番検査: ${failures.length}件の不一致`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`LARU HP 本番検査: OK（sitemap ${sitemapUrls.length}ページ、内部URL ${internalUrls.size}件、問い合わせ・PWA・旧入口・保護API ${protectedWrites.length}件）`);
}
