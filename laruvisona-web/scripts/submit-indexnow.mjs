import fs from 'node:fs/promises';

const siteOrigin = 'https://laruhp.com';
const keyPath = new URL('../public/indexnow-key.txt', import.meta.url);
const key = (await fs.readFile(keyPath, 'utf8')).trim();

if (!/^[A-Za-z0-9-]{8,128}$/.test(key)) {
  throw new Error('IndexNow key file is malformed');
}

const keyLocation = `${siteOrigin}/indexnow-key.txt`;
const [keyResponse, sitemapResponse] = await Promise.all([
  fetch(keyLocation, { redirect: 'error' }),
  fetch(`${siteOrigin}/sitemap.xml`, { redirect: 'error' }),
]);

if (!keyResponse.ok || (await keyResponse.text()).trim() !== key) {
  throw new Error('The deployed IndexNow key does not match the repository key');
}
if (!sitemapResponse.ok) {
  throw new Error(`Could not load the deployed sitemap (${sitemapResponse.status})`);
}

const sitemap = await sitemapResponse.text();
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
if (urlList.length === 0 || urlList.some(url => new URL(url).origin !== siteOrigin)) {
  throw new Error('The sitemap is empty or contains a different host');
}

const response = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: 'laruhp.com', key, keyLocation, urlList }),
});

if (![200, 202].includes(response.status)) {
  throw new Error(`IndexNow rejected the request (${response.status})`);
}

console.log(`IndexNow accepted ${urlList.length} URLs (HTTP ${response.status})`);
