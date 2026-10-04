// LARU HP の顧客サイト上の LARU SEO 記事ページ（/articles・/articles/<slug>・サイトマップ）を、実際のサーバーで確かめる。
// 前提: 偽DB（tests/http/fixture.cjs :54999）・Content API の代わり（tests/http/seo-content-mock.cjs :54997）・
//       LARUBOT_API_URL=http://127.0.0.1:54997 HP_SEO_CONTENT_FRESH_MS=0 で起動した fixture 向けビルド（:3319）
import http from 'node:http';

const APP = { host: '127.0.0.1', port: 3319 };
const fixture = 'http://127.0.0.1:54999', mock = 'http://127.0.0.1:54997';
const OWNER = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok }); console.log(ok ? 'OK  ' : 'FAIL', name, detail); };
const post = (u, body) => fetch(u, { method: 'POST', body: JSON.stringify(body) }).then((r) => r.json());
const control = (b) => post(fixture + '/__control', b);
const state = (b) => post(mock + '/__state', b);
const mockCalls = () => fetch(mock + '/__state').then((r) => r.json());
function get(path, host = 'laruvisona.jp', headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ ...APP, path, method: 'GET', headers: { Host: host, ...headers } }, (res) => {
      let body = ''; res.setEncoding('utf8'); res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject); req.end();
  });
}

const BASE_A = 'https://laruvisona.jp/hp/site-a', DOMAIN_A = 'https://salon-a.example';
const item = (n, extra = {}) => ({ id: n, slug: `article-${n}`, title: `記事${n}の題名`, meta_description: `記事${n}の説明`, target_keyword: 'k',
  thumbnail_url: n % 2 ? `https://img.example/${n}.webp` : null, published_at: `2026-10-0${(n % 9) + 1}T00:00:00.000000`, updated_at: `2026-10-0${(n % 9) + 1}T01:00:00.000000`,
  canonical_url: `https://larubot.tokyo/blog/article-${n}`, ...extra });
const detail = (n, extra = {}) => ({ status: 200, body: { ...item(n), author: 'Aサロン', content_html: `<h2>記事${n}の見出し</h2><p>BODY_${n}_TEXT</p><table><tr><td>${'長い表の中身'.repeat(20)}</td></tr></table>`, indexable: true, is_primary_target: false, status: 'published', ...extra } });
const PUB_INTERNAL = { target_type: 'internal_blog', canonical_base: 'https://larubot.tokyo', article_path: '/blog/{slug}', canonical_policy: 'single_primary' };
const pubHere = (base) => ({ target_type: 'laruhp', canonical_base: base, article_path: '/articles/{slug}', canonical_policy: 'single_primary' });

try {
  await control({ patchProfile: { id: OWNER, patch: { plan: 'hp-bot-seo', subscription_status: 'active' } } });
  await control({ patchSite: { id: 'id-a', patch: { user_id: OWNER, custom_domain: null, settings_json: { laruseoPublicId: 'pidA', laruseo: true } } } });
  await control({ patchSite: { id: 'id-b', patch: { user_id: OWNER, settings_json: { laruseoPublicId: 'pidB', laruseo: true } } } });
  const items = Array.from({ length: 25 }, (_, i) => item(25 - i));
  const details = Object.fromEntries(items.map((x) => [x.slug, detail(Number(x.slug.split('-')[1]))]));
  await state({ tenants: {
    pidA: { publication: PUB_INTERNAL, items, details: { ...details, 'old-slug': { status: 404, body: { error: 'moved', slug: 'mid-slug' } }, 'mid-slug': { status: 404, body: { error: 'moved', slug: 'article-3' } }, deleted: { status: 410, body: { error: 'gone' } } } },
    pidB: { publication: PUB_INTERNAL, items: [item(900)], details: { 'article-900': detail(900) } },
  } });

  /* 登録前（LARU 側が正規）：出すが index しない。canonical は API の値 */
  const list = await get('/hp/site-a/articles');
  check('一覧 200・サーバーの HTML に題名とリンク', list.status === 200 && list.body.includes('記事25の題名') && list.body.includes(`href="${BASE_A}/articles/article-25"`));
  check('一覧：20件で区切り、次のページへの通常のリンク', (list.body.match(/class="card"/g) || []).length === 20 && list.body.includes(`href="${BASE_A}/articles?page=2" rel="next"`));
  check('一覧：画像は有る記事だけ', (list.body.match(/<img /g) || []).length === 10);
  check('一覧：登録前は noindex', /noindex,follow/.test(list.body));
  const p2 = await get('/hp/site-a/articles?page=2');
  check('一覧 2ページ目：残り5件・前へ', p2.status === 200 && (p2.body.match(/class="card"/g) || []).length === 5 && p2.body.includes('rel="prev"'));
  check('一覧：無いページは 404', (await get('/hp/site-a/articles?page=9')).status === 404);
  const d = await get('/hp/site-a/articles/article-3');
  check('本文 200・サーバーの HTML に題名と本文', d.status === 200 && d.body.includes('<h1>記事3の題名</h1>') && d.body.includes('BODY_3_TEXT'));
  check('本文：登録前は noindex・canonical は API の値（LARU 側）', /noindex,follow/.test(d.body) && d.body.includes('<link rel="canonical" href="https://larubot.tokyo/blog/article-3">'));
  check('本文：Article・パンくずの構造化データ、OGP', /"@type":"Article"/.test(d.body) && /"@type":"BreadcrumbList"/.test(d.body) && /og:type" content="article"/.test(d.body));
  check('本文：会社サイトの構造化データ・計測・チャットを混ぜない', !/LaruVisona|googletagmanager|larubot\.tokyo\/static\/embed/.test(d.body));
  check('本文：キャッシュ（CDN 5分）と ETag', /s-maxage=300/.test(d.headers['cache-control'] || '') && !!d.headers.etag);
  check('本文：ETag 一致で 304', (await get('/hp/site-a/articles/article-3', 'laruvisona.jp', { 'If-None-Match': d.headers.etag })).status === 304);
  check('下書き・無い slug は 404', (await get('/hp/site-a/articles/draft-only')).status === 404);
  const mv = await get('/hp/site-a/articles/old-slug');
  check('slug の変更：最後の行き先へ 301 を1回', mv.status === 301 && mv.headers.location === `${BASE_A}/articles/article-3`, mv.headers.location);
  const gone = await get('/hp/site-a/articles/deleted');
  check('削除：410', gone.status === 410 && /noindex/.test(gone.body));
  check('形の合わない slug は 404', (await get('/hp/site-a/articles/..%2Fx')).status === 404);

  /* 他社・別サイトの混入なし */
  check('別サイトの public_id の記事は、このサイトで出さない', (await get('/hp/site-a/articles/article-900')).status === 404);
  check('別サイトの記事は、そのサイトでは出る', (await get('/hp/site-b/articles/article-900')).status === 200);
  check('別ホストから他サイトの記事を開けない', (await get('/hp/site-a/articles/article-3', 'bistro-b.example')).status === 404);
  check('未公開サイトは 404', (await get('/hp/site-c/articles')).status === 404);
  check('laruhp.com では顧客サイトの記事を出さない', (await get('/hp/site-a/articles', 'laruhp.com')).status === 404);

  /* 独自ドメイン：同じサイトとして出し、正規 URL は独自ドメイン */
  await control({ patchSite: { id: 'id-a', patch: { custom_domain: 'salon-a.example' } } });
  const cd = await get('/articles/article-3', 'salon-a.example');
  check('独自ドメインの /articles/<slug> も 200（同じサイト）', cd.status === 200 && cd.body.includes('BODY_3_TEXT') && cd.body.includes(`href="${DOMAIN_A}/articles"`));
  const viaPath = await get('/hp/site-a/articles/article-3');
  check('パス形式で開いても、サイト内リンクは独自ドメインの正規 URL', viaPath.body.includes(`href="${DOMAIN_A}"`));

  /* 登録後（このサイトが正規）：index・canonical はこのサイト・サイトマップに載る */
  const hereItems = items.map((x) => ({ ...x, canonical_url: `${DOMAIN_A}/articles/${x.slug}` }));
  const hereDetails = Object.fromEntries(Object.entries(details).map(([k, v]) => [k, { ...v, body: { ...v.body, canonical_url: `${DOMAIN_A}/articles/${k}`, is_primary_target: true } }]));
  await state({ tenants: { pidA: { publication: pubHere(DOMAIN_A), items: hereItems, details: hereDetails }, pidB: { publication: pubHere(DOMAIN_A), items: [item(900)], details: { 'article-900': detail(900) } } } });
  const hd = await get('/articles/article-3', 'salon-a.example');
  check('登録後：index・canonical はこのサイトの記事 URL', /<meta name="robots" content="index,follow/.test(hd.body) && hd.body.includes(`<link rel="canonical" href="${DOMAIN_A}/articles/article-3">`));
  const hl = await get('/articles', 'salon-a.example');
  check('登録後：一覧も index', /<meta name="robots" content="index,follow/.test(hl.body));
  const sm = await get('/hp/site-a/sitemap.xml');
  check('サイトマップ：記事 25 件と一覧・lastmod は更新日', sm.status === 200 && (sm.body.match(/\/articles\/article-/g) || []).length === 25 && sm.body.includes(`<loc>${DOMAIN_A}/articles</loc>`) && sm.body.includes('<lastmod>2026-10-04</lastmod>'));
  check('同じ public_id の別サイト（正規は A）では出さない', (await get('/hp/site-b/articles/article-900')).status === 404 && (await get('/hp/site-b/articles')).status === 404);
  const smB = await get('/hp/site-b/sitemap.xml');
  check('別サイトのサイトマップに載らない', smB.status === 200 && !/\/articles/.test(smB.body));
  const indexable0 = { ...hereDetails['article-5'], body: { ...hereDetails['article-5'].body, indexable: false } };
  await state({ tenants: { pidA: { publication: pubHere(DOMAIN_A), items: hereItems, details: { ...hereDetails, 'article-5': indexable0 } } } });
  check('indexable=false は index にしない', /noindex/.test((await get('/articles/article-5', 'salon-a.example')).body));

  /* ライフサイクル：更新・取り消し・slug 変更 */
  const updated = { ...hereDetails['article-3'], body: { ...hereDetails['article-3'].body, title: '記事3の新しい題名', updated_at: '2026-10-09T05:00:00.000000', content_html: '<p>UPDATED_BODY</p>' } };
  await state({ tenants: { pidA: { publication: pubHere(DOMAIN_A), items: hereItems.map((x) => (x.slug === 'article-3' ? { ...x, title: '記事3の新しい題名', updated_at: '2026-10-09T05:00:00.000000' } : x)), details: { ...hereDetails, 'article-3': updated } } } });
  const up = await get('/articles/article-3', 'salon-a.example');
  check('更新：本文・題名・更新日', up.body.includes('UPDATED_BODY') && up.body.includes('記事3の新しい題名') && up.body.includes('"dateModified":"2026-10-09T05:00:00.000Z"'));
  check('更新：サイトマップの lastmod', (await get('/hp/site-a/sitemap.xml')).body.includes('<lastmod>2026-10-09</lastmod>'));
  const { 'article-3': _removed, ...withoutA3 } = hereDetails;
  await state({ tenants: { pidA: { publication: pubHere(DOMAIN_A), items: hereItems.filter((x) => x.slug !== 'article-3'), details: { ...withoutA3, 'article-3x': hereDetails['article-3'] } } } });
  check('公開の取り消し：404（index に残さない）・サイトマップから消える', (await get('/articles/article-3', 'salon-a.example')).status === 404 && !(await get('/hp/site-a/sitemap.xml')).body.includes('/articles/article-3<'));
  await state({ tenants: { pidA: { publication: pubHere(DOMAIN_A), items: hereItems, details: { ...hereDetails, 'article-3': { status: 404, body: { error: 'moved', slug: 'article-4' } } } } } });
  const sc = await get('/articles/article-3', 'salon-a.example');
  check('slug の変更：旧 URL → 新 URL へ 301', sc.status === 301 && sc.headers.location === `${DOMAIN_A}/articles/article-4`);

  /* 検証付きの取り直し（LARU SEO への 304） */
  const before = await mockCalls();
  await get('/articles/article-6', 'salon-a.example');
  await get('/articles/article-6', 'salon-a.example');
  const after = await mockCalls();
  check('LARU SEO へは ETag 付きで確かめ直し、変わっていなければ 304', after.conditional > before.conditional);

  /* 0件・LARU SEO に届かない・契約・設定 */
  await state({ tenants: { pidA: { publication: PUB_INTERNAL, items: [], details: {} } } });
  const empty = await get('/articles', 'salon-a.example');
  check('0件：自然な空の案内', empty.status === 200 && empty.body.includes('まだ記事はありません'));
  await control({ patchSite: { id: 'id-a', patch: { settings_json: { laruseoPublicId: 'pidA', laruseo: false } } } });
  check('LARU SEO を設定で切ったサイトは 404', (await get('/articles', 'salon-a.example')).status === 404);
  await control({ patchSite: { id: 'id-a', patch: { settings_json: { laruseoPublicId: 'pidA', laruseo: true } } } });
  await control({ patchProfile: { id: OWNER, patch: { plan: 'hp', subscription_status: 'active' } } });
  check('持ち主の契約に LARU SEO が無ければ 404（公開ページの blog.js と同じ判定）', (await get('/articles', 'salon-a.example')).status === 404);
  await control({ patchProfile: { id: OWNER, patch: { plan: 'hp-bot-seo', subscription_status: 'active' } } });
  await state({ tenants: {} });
  check('LARU SEO が知らない public_id：一覧は 404', (await get('/articles', 'salon-a.example')).status === 404);

  /* 既存の公開ページ：blog.js は残り、記事一覧への通常のリンクが増える */
  const top = await get('/', 'salon-a.example');
  check('公開ページ：blog.js は残す・記事一覧への通常のリンク', top.status === 200 && top.body.includes('embed/blog.js') && top.body.includes(`href="${DOMAIN_A}/articles"`));
} catch (e) {
  check('途中で止まりました', false, String(e).slice(0, 300));
} finally {
  await control({ patchSite: { id: 'id-a', patch: { custom_domain: 'salon-a.example', settings_json: {} } } }).catch(() => {});
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length}`);
process.exit(failed.length ? 1 : 0);
