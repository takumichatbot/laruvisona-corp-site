// お知らせ記事・ショップのページに出る「サイト名」が、親サイトを公開した時点の名前になること。
// 親サイト名Aで公開 → 親サイト名Bを下書き保存 → 記事・ショップの公開側はAのまま。
// 記事の題名・商品名は従来どおり（記事は記事の公開、商品はショップの設定）に従う。
//   起動・実行は republish-draft-check.mjs と同じ（fixture・next start -p 3319）
const base = process.env.BASE || 'http://127.0.0.1:3319';
const SITE = 'd41d8cd9-8f00-4b20-a204-9800998ecf84', SLUG = 'kyuu-site';
const session = { access_token: 'stub', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r',
  user: { id: '7c9e6679-7425-40de-944b-e07fc1f90ae7', email: 'owner@example.com', aud: 'authenticated', role: 'authenticated' } };
const cookie = `sb-127-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString('base64')}`;
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok }); console.log(ok ? 'OK  ' : 'FAIL', name, detail); };
const owner = (path, method, body) => fetch(base + path, { method, headers: { cookie, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }).then((r) => r.status);
// 取得器（OGカードを読む側）と同じ UA で読むと、title・og は head に出る
const page = async (path) => (await fetch(base + path, { headers: { 'user-agent': 'Twitterbot/1.0' } })).text();
const pick = (html) => ({
  title: (html.match(/<title>([^<]*)<\/title>/) || [])[1] || '',
  ogTitle: (html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"/) || [])[1] || '',
  hasA: html.includes('親サイト名A_NAME'), hasB: html.includes('親サイト名B_NAME'),
});
const blocks = { v: 2, pages: [{ id: 'page-main', name: 'トップページ', path: '/', blocks: [{ id: 'lb-hero', type: 'hero', data: { heading: '見出し', ctaText: '相談', ctaLink: '#c' } }] }] };
const products = [{ id: 'p1', name: '商品の名前_PRODUCT', description: '', price: 1000, images: [], stock: null, active: true, category: '' }];
try {
  check('A：保存', await owner(`/api/sites/${SITE}`, 'PUT', { name: '親サイト名A_NAME', blocks_json: blocks, seo_json: { title: '', description: '' }, settings_json_patch: { products } }) === 200);
  check('A：公開', await owner(`/api/sites/${SITE}/publish`, 'POST') === 200);
  check('B：サイト名だけ下書き保存（公開しない）', await owner(`/api/sites/${SITE}`, 'PUT', { name: '親サイト名B_NAME' }) === 200);
  const post = await page(`/hp/${SLUG}/post/kyuu-post`), postP = pick(post);
  check('記事：題名は記事の題名＋公開時点のサイト名A（Bは出ない）', postP.title === '記事の題名_POST | 親サイト名A_NAME' && postP.hasA && !postP.hasB, JSON.stringify(postP));
  check('記事：構造化データの発行元もA', /"publisher":\{"@type":"Organization","name":"親サイト名A_NAME"/.test(post));
  const shop = await page(`/hp/${SLUG}/shop`), shopP = pick(shop);
  check('ショップ：題名・見出し・構造化データはA（Bは出ない）、商品名は出る', shopP.title === '親サイト名A_NAME — ショップ' && shopP.ogTitle === shopP.title && !shopP.hasB && shop.includes('商品の名前_PRODUCT'), JSON.stringify(shopP));
  check('親を公開すると：記事・ショップのサイト名がBに', await owner(`/api/sites/${SITE}/publish`, 'POST') === 200
    && pick(await page(`/hp/${SLUG}/post/kyuu-post`)).title === '記事の題名_POST | 親サイト名B_NAME'
    && pick(await page(`/hp/${SLUG}/shop`)).title === '親サイト名B_NAME — ショップ');
} finally {
  const failed = results.filter((x) => !x.ok);
  console.log(`\n${results.length - failed.length}/${results.length} OK`);
  if (failed.length) process.exitCode = 1;
}
