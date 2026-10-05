// laruvisona.jp / laruhp.com の公開ページを、サイトマップから全部たどって確かめる（technical SEO の回帰）。
//   200・題と説明がある・題が重複しない・H1 が 1 つ・canonical が自分・noindex でない・
//   サイト内リンクが 3xx/4xx を指していない・FAQ の構造化データが画面の文と一致・Organization がある。
// 前提: fixture 向けビルドが :3319 で動いていること（tests/http/hp-seo-articles.sh と同じ）。
//   node tests/http/organic-seo-check.mjs
import http from 'node:http';
const HOSTS = ['laruvisona.jp', 'laruhp.com'];
// 公開ページではない（アプリ・ログイン）ので、リダイレクトしても検索には関係しないリンク
const APP_LINK = /^https:\/\/(laruvisona\.jp|laruhp\.com)\/laruHP\/(auth|studio|dashboard|builder|onboarding|continue|settings)|^https:\/\/laruvisona\.jp\/hp\//;
const results = [];
const check = (name, ok, detail = '') => { results.push(!!ok); if (!ok || process.env.VERBOSE) console.log(ok ? 'OK  ' : 'FAIL', name, detail); };
// fetch は Host を差し替えられないので、http で送る（ホストで出し分けるため）
const get = (host, path) => new Promise((resolve, reject) => {
  const req = http.request({ host: '127.0.0.1', port: 3319, path, method: 'GET', headers: { Host: host, 'User-Agent': 'Mozilla/5.0 (seo-check)' } }, (res) => {
    let body = ''; res.setEncoding('utf8'); res.on('data', (c) => (body += c));
    res.on('end', () => resolve({ status: res.statusCode, location: res.headers.location ?? null, text: body }));
  });
  req.on('error', reject); req.end();
});
const strip = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
const norm = (s) => s.replace(/\s+/g, '');

const linkStatus = new Map();
async function statusOf(url) {
  if (linkStatus.has(url)) return linkStatus.get(url);
  const u = new URL(url);
  const r = await get(u.hostname, u.pathname + u.search);
  linkStatus.set(url, r.status);
  return r.status;
}

let pages = 0;
for (const host of HOSTS) {
  const sm = await get(host, '/sitemap.xml');
  const urls = [...sm.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).filter((u) => !/\/hp\//.test(u));
  check(`${host}: サイトマップが読める`, sm.status === 200 && urls.length > 5, String(urls.length));
  const titles = new Map();
  for (const url of urls) {
    const u = new URL(url);
    const r = await get(u.hostname, u.pathname || '/');
    pages++;
    const p = `${host}${u.pathname}`;
    if (r.status !== 200) { check(`${p}: 200`, false, String(r.status)); continue; }
    const s = r.text;
    const title = (s.match(/<title>(.*?)<\/title>/s) || [])[1] || '';
    const desc = (s.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
    const canonical = (s.match(/<link rel="canonical" href="([^"]+)"/) || [])[1] || '';
    const robots = (s.match(/<meta name="robots" content="([^"]+)"/) || [])[1] || '';
    const h1 = (s.match(/<h1[\s>]/g) || []).length;
    check(`${p}: 題と説明がある`, title.length >= 10 && desc.length >= 30, `${title.length}/${desc.length}`);
    check(`${p}: H1 は 1 つ`, h1 === 1, String(h1));
    check(`${p}: canonical が自分`, canonical.replace(/\/$/, '') === url.replace(/\/$/, ''), canonical);
    check(`${p}: noindex でない`, !/noindex/.test(robots), robots);
    if (titles.has(title)) check(`${p}: 題が重複しない`, false, `${titles.get(title)} と同じ`);
    titles.set(title, p);
    check(`${p}: Organization の構造化データ`, /"@type":"Organization"/.test(s));
    // FAQ の構造化データは、画面に同じ問いがあるときだけ
    for (const m of s.matchAll(/<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs)) {
      let data; try { data = JSON.parse(m[1]); } catch { continue; }
      for (const node of [data].flat().flatMap((d) => (d && d['@graph']) ? d['@graph'] : [d])) {
        if (node?.['@type'] !== 'FAQPage') continue;
        const visible = norm(strip(s.replace(/<script[\s\S]*?<\/script>/g, '')));
        const missing = (node.mainEntity || []).filter((q) => !visible.includes(norm(q.name)));
        check(`${p}: FAQ の構造化データが画面と一致`, missing.length === 0, missing.map((q) => q.name).join(' / '));
      }
    }
    // サイト内リンク（両ドメイン）が、リダイレクトや 404 を指していない
    const links = [...new Set([...s.matchAll(/href="(https:\/\/(?:laruvisona\.jp|laruhp\.com)[^"#]*|\/[^"#/][^"#]*)"/g)].map((m) => m[1]))]
      .filter((h) => !/\/_next\/|\.(png|ico|json|jpg|webp|svg|xml|txt)$/.test(h))
      .map((h) => (h.startsWith('/') ? `https://${host}${h}` : h))
      .filter((h) => !APP_LINK.test(h));
    for (const link of links) {
      const st = await statusOf(link);
      if (st !== 200) check(`${p}: リンク先 ${link}`, false, String(st));
    }
  }
}
check('サイト内リンクを確かめた', linkStatus.size > 50, String(linkStatus.size));
console.log(`\npages=${pages} links=${linkStatus.size}  ${results.filter(Boolean).length}/${results.length}`);
process.exit(results.every(Boolean) ? 0 : 1);
