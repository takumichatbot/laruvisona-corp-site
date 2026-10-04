import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parseItem, parseArticle, parsePublication, targetState, articleIndexing, getContent, listContent, resolveMoved,
  sitemapArticles, clearContentCache, utcIso, articleUrl, listUrl,
} from '../lib/hp-seo-content';
import { articlePageHtml, listPageHtml, statusPageHtml } from '../lib/hp-article-html';
import { withSeoArticleSlot } from '../lib/larubot-public-id';

// 実際の応答（larubot.tokyo 2026-10-04・自社の public_id）と仕様書の例の形
const ITEM = {
  canonical_url: 'https://larubot.tokyo/blog/laruvisona-contact-window-support-2026', id: 406,
  meta_description: '問い合わせ窓口の説明', published_at: '2026-10-04T00:08:06.424754', slug: 'laruvisona-contact-window-support-2026',
  target_keyword: '問い合わせ 窓口', thumbnail_url: 'https://larubot-uploads-20250901.s3.amazonaws.com/uploads/seo/74/a_thumb.webp',
  title: '問い合わせ窓口の対応と連絡先まとめ', updated_at: '2026-10-04T00:08:06.424757',
};
const PUB_INTERNAL = { article_path: '/blog/{slug}', canonical_base: 'https://larubot.tokyo', canonical_policy: 'single_primary', target_type: 'internal_blog' };
const BASE = 'https://midori-dental.jp';
const PUB_HERE = { article_path: '/articles/{slug}', canonical_base: BASE, canonical_policy: 'single_primary', target_type: 'laruhp' };
const DETAIL = { ...ITEM, author: 'みどり歯科', content_html: '<h2>見出し</h2><p>本文<script>alert(1)</script><img src=x onerror=alert(1)></p><table><tr><td>表</td></tr></table>', indexable: true, is_primary_target: false, status: 'published', publication: PUB_INTERNAL };
const site = { base: BASE, siteName: 'みどり歯科', design: null, fontFamily: '' };

test('応答の欄：実際の名前で読み、形の違う値は捨てる', () => {
  const it = parseItem(ITEM)!;
  assert.equal(it.slug, ITEM.slug);
  assert.equal(it.publishedAt, '2026-10-04T00:08:06.424Z', 'タイムゾーン表記なしは UTC として読む');
  assert.equal(it.canonicalUrl, ITEM.canonical_url);
  assert.equal(parseItem({ ...ITEM, slug: '../x' }), null);
  assert.equal(parseItem({ ...ITEM, id: '406' }), null);
  assert.equal(parseItem({ ...ITEM, thumbnail_url: 'http://x/y.png' })!.thumbnailUrl, null, 'https 以外の画像は使わない');
  assert.equal(parseItem({ ...ITEM, canonical_url: null })!.canonicalUrl, null);
  assert.equal(utcIso('2026-10-03T09:40:11+09:00'), '2026-10-03T00:40:11.000Z');
  const a = parseArticle(DETAIL)!;
  assert.ok(!/script|onerror/i.test(a.html), '本文は除菌してから使う');
  assert.equal(a.indexable, true);
  assert.equal(a.isPrimaryTarget, false);
  assert.equal(parseArticle({ ...DETAIL, content_html: '' }), null);
  assert.deepEqual(parsePublication(PUB_HERE), { targetType: 'laruhp', canonicalBase: BASE, articlePath: '/articles/{slug}', canonicalPolicy: 'single_primary' });
});

test('正規の公開先：このサイト／別サイト／未登録を分け、index はこのサイトが正規で値が一致するときだけ', () => {
  assert.equal(targetState(parsePublication(PUB_INTERNAL), BASE), 'unregistered');
  assert.equal(targetState(parsePublication(PUB_HERE), BASE), 'here');
  assert.equal(targetState(parsePublication(PUB_HERE), `${BASE}/`), 'here');
  assert.equal(targetState(parsePublication({ ...PUB_HERE, canonical_base: 'https://other.example' }), BASE), 'elsewhere');
  assert.equal(targetState(parsePublication({ ...PUB_HERE, article_path: '/blog/{slug}' }), BASE), 'elsewhere');
  const art = { slug: 's1', indexable: true, isPrimaryTarget: true, canonicalUrl: `${BASE}/articles/s1` };
  assert.equal(articleIndexing({ state: 'here', siteNoIndex: false, siteBase: BASE, article: art }).index, true);
  assert.equal(articleIndexing({ state: 'unregistered', siteNoIndex: false, siteBase: BASE, article: art }).index, false, '登録前は index しない');
  assert.equal(articleIndexing({ state: 'here', siteNoIndex: true, siteBase: BASE, article: art }).index, false, 'サイトの「検索に出さない」に従う');
  assert.equal(articleIndexing({ state: 'here', siteNoIndex: false, siteBase: BASE, article: { ...art, indexable: false } }).index, false, 'indexable=false を index にしない');
  assert.equal(articleIndexing({ state: 'here', siteNoIndex: false, siteBase: BASE, article: { ...art, isPrimaryTarget: false } }).index, false);
  const other = articleIndexing({ state: 'here', siteNoIndex: false, siteBase: BASE, article: { ...art, canonicalUrl: 'https://larubot.tokyo/blog/s1' } });
  assert.equal(other.index, false);
  assert.equal(other.canonical, 'https://larubot.tokyo/blog/s1', 'canonical は API の値のまま');
});

test('本文の HTML：サーバーで本文・題名・canonical・robots・OGP・Article/パンくず。会社サイトの名乗りは混ぜない', () => {
  const a = parseArticle(DETAIL)!;
  const preHtml = articlePageHtml({ site, article: a, canonical: a.canonicalUrl, index: false, related: [parseItem(ITEM)!, parseItem({ ...ITEM, id: 1, slug: 'other-1', title: '別の記事' })!] });
  assert.match(preHtml, /<h1>問い合わせ窓口の対応と連絡先まとめ<\/h1>/);
  assert.match(preHtml, /<h2>見出し<\/h2>/);
  assert.match(preHtml, /<meta name="robots" content="noindex,follow">/);
  assert.match(preHtml, /<link rel="canonical" href="https:\/\/larubot\.tokyo\/blog\/laruvisona-contact-window-support-2026">/);
  assert.match(preHtml, /og:type" content="article"/);
  assert.match(preHtml, /href="https:\/\/midori-dental\.jp\/articles\/other-1"/, 'ほかの記事への通常のリンク');
  assert.ok(!preHtml.includes('href="https://midori-dental.jp/articles/laruvisona-contact-window-support-2026">'), '自分自身は「ほかの記事」に出さない');
  assert.ok(!/LaruVisona|laruvisona\.jp/.test(preHtml.replace(/laruvisona-contact-window-support-2026/g, '')), '会社サイトの構造化データ・計測を混ぜない');
  const ld = JSON.parse(preHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]);
  assert.equal(ld[0]['@type'], 'Article');
  assert.equal(ld[0].datePublished, '2026-10-04T00:08:06.424Z');
  assert.equal(ld[0].publisher.name, 'みどり歯科');
  assert.equal(ld[0].author.name, 'みどり歯科');
  assert.ok(!('telephone' in ld[0].publisher) && !('address' in ld[0].publisher), '構造化データに連絡先などを足さない');
  assert.equal(ld[1]['@type'], 'BreadcrumbList');
  const own = `${BASE}/articles/${a.slug}`;
  const hereHtml = articlePageHtml({ site, article: { ...a, canonicalUrl: own }, canonical: own, index: true, related: [] });
  assert.match(hereHtml, /<meta name="robots" content="index,follow/);
  assert.match(hereHtml, new RegExp(`<link rel="canonical" href="${own}">`));
  // 文字の差し込み
  const evil = articlePageHtml({ site: { ...site, siteName: '<b>x</b>' }, article: { ...a, title: '"><script>x</script>' }, canonical: null, index: false, related: [] });
  assert.ok(!evil.includes('<script>x</script>') && !evil.includes('<b>x</b>'));
});

test('一覧の HTML：公開済みだけ・通常のリンク・ページ送り・0件の案内', () => {
  const items = [parseItem(ITEM)!, parseItem({ ...ITEM, id: 2, slug: 'no-image', thumbnail_url: null })!];
  const html = listPageHtml({ site, items, page: 2, hasNext: true, index: true });
  assert.match(html, /href="https:\/\/midori-dental\.jp\/articles\/no-image"/);
  assert.equal((html.match(/<img /g) || []).length, 1, '画像は有るときだけ');
  assert.match(html, /rel="prev"/);
  assert.match(html, /href="https:\/\/midori-dental\.jp\/articles\?page=3" rel="next"/);
  assert.match(html, /<link rel="canonical" href="https:\/\/midori-dental\.jp\/articles\?page=2">/);
  const empty = listPageHtml({ site, items: [], page: 1, hasNext: false, index: false });
  assert.match(empty, /まだ記事はありません/);
  assert.match(statusPageHtml(410, site), /削除されました/);
  assert.equal(listUrl(BASE), `${BASE}/articles`);
  assert.equal(articleUrl('https://laruvisona.jp/hp/site-a', 'x'), 'https://laruvisona.jp/hp/site-a/articles/x');
});

/* ── 取得：fetch を差し替えて、契約どおりの応答を返す ── */
type Reply = { status: number; body: unknown; headers?: Record<string, string> };
function mockFetch(routes: Record<string, Reply | ((h: Headers) => Reply)>) {
  const calls: { url: string; headers: Headers }[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    calls.push({ url, headers });
    const key = Object.keys(routes).find((k) => url.endsWith(k));
    const r = key ? routes[key] : { status: 404, body: { error: 'not_found' } };
    const reply = typeof r === 'function' ? r(headers) : r;
    return new Response(reply.status === 304 ? null : JSON.stringify(reply.body), { status: reply.status, headers: reply.headers });
  }) as typeof fetch;
  return calls;
}

test('本文の取得：not_found／moved（最後の行き先まで）／gone／届かない を分ける', async () => {
  clearContentCache();
  mockFetch({
    '/pid1/live': { status: 200, body: DETAIL },
    '/pid1/old': { status: 404, body: { error: 'moved', slug: 'mid' } },
    '/pid1/mid': { status: 404, body: { error: 'moved', slug: 'live' } },
    '/pid1/deleted': { status: 410, body: { error: 'gone' } },
    '/pid1/loop': { status: 404, body: { error: 'moved', slug: 'loop' } },
    '/pid1/err': { status: 500, body: {} },
  });
  assert.equal((await getContent('pid1', 'live')).kind, 'ok');
  assert.deepEqual(await getContent('pid1', 'old'), { kind: 'moved', slug: 'mid' });
  assert.equal(await resolveMoved('pid1', 'old'), 'live', '転送を重ねず、最後の行き先へ1回で');
  assert.equal((await getContent('pid1', 'deleted')).kind, 'gone');
  assert.equal((await getContent('pid1', 'nothing')).kind, 'not_found');
  assert.equal((await getContent('pid1', 'loop')).kind, 'not_found', '同じ slug への移動は無いものとして扱う');
  assert.equal((await getContent('pid1', 'err')).kind, 'unavailable');
  assert.equal((await getContent('bad id!', 'live')).kind, 'not_found', '形の合わない public_id では取りに行かない');
  globalThis.fetch = (async () => { throw new Error('timeout'); }) as typeof fetch;
  assert.equal((await getContent('pid1', 'x-timeout')).kind, 'unavailable');
});

test('キャッシュ：5分は手元の控え、過ぎたら ETag で確かめ、304 なら中身を使い回す。エラーは控えない', async (t) => {
  clearContentCache();
  let now = 1_000_000;
  t.mock.method(Date, 'now', () => now);
  const calls = mockFetch({
    '/pid2?page=1&limit=20': (h) => (h.get('if-none-match') === '"v1"' ? { status: 304, body: null } : { status: 200, body: { total: 1, page: 1, limit: 20, has_next: false, items: [ITEM], publication: PUB_INTERNAL }, headers: { ETag: '"v1"' } }),
  });
  assert.equal((await listContent('pid2')).ok, true);
  await listContent('pid2');
  assert.equal(calls.length, 1, '5分以内は取りに行かない');
  now += 301_000;
  const again = await listContent('pid2');
  assert.equal(calls.length, 2);
  assert.equal(calls[1].headers.get('if-none-match'), '"v1"');
  assert.ok(again.ok && again.items.length === 1, '304 なら前の中身');
});

test('サイトマップ：このサイトが正規のときだけ・正規 URL が一致する記事だけ・lastmod は更新日時', async () => {
  clearContentCache();
  const here = { ...ITEM, canonical_url: `${BASE}/articles/${ITEM.slug}` };
  const stray = { ...ITEM, id: 9, slug: 'stray', canonical_url: 'https://larubot.tokyo/blog/stray' };
  mockFetch({
    '/pid3?page=1&limit=100': { status: 200, body: { total: 3, page: 1, limit: 100, has_next: true, items: [here, stray], publication: PUB_HERE } },
    '/pid3?page=2&limit=100': { status: 200, body: { total: 3, page: 2, limit: 100, has_next: false, items: [{ ...here, id: 5, slug: 'second', canonical_url: `${BASE}/articles/second` }], publication: PUB_HERE } },
    '/pid4?page=1&limit=100': { status: 200, body: { total: 1, page: 1, limit: 100, has_next: false, items: [ITEM], publication: PUB_INTERNAL } },
  });
  const rows = await sitemapArticles('pid3', BASE);
  assert.deepEqual(rows.map((r) => r.loc), [`${BASE}/articles/${ITEM.slug}`, `${BASE}/articles/second`]);
  assert.equal(rows[0].lastmod, '2026-10-04T00:08:06.424Z');
  assert.deepEqual(await sitemapArticles('pid4', BASE), [], '登録前（LARU 側が正規）は載せない＝二重掲載しない');
  assert.deepEqual(await sitemapArticles('pid3', 'https://other.example'), [], '同じ public_id の別サイトには載せない');
});

test('公開ページの記事の置き場に、記事一覧への通常のリンクを1つ置く（blog.js は残す）', () => {
  const html = withSeoArticleSlot('<main>x</main><footer>f</footer>', 'https://laruvisona.jp/hp/site-a/articles');
  assert.match(html, /<a href="https:\/\/laruvisona\.jp\/hp\/site-a\/articles">コラムの一覧へ<\/a>/);
  assert.ok(html.indexOf('laru-seo-articles') < html.indexOf('<footer>'));
  assert.ok(!withSeoArticleSlot('<footer></footer>', 'javascript:alert(1)').includes('javascript:'));
  const page = readFileSync(new URL('../app/hp/[slug]/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /embed\/blog\.js/, '既存の blog.js は残す');
  assert.match(page, /withSeoArticleSlot\(eagerHtml, listUrl\(base\)\)/);
});

test('HP 側に記事の生成・下書き・枠・プランの判定を持たない。秘密の鍵を使わない', () => {
  for (const f of ['../lib/hp-seo-content.ts', '../lib/hp-article-site.ts', '../app/hp/[slug]/articles/route.ts', '../app/hp/[slug]/articles/[articleSlug]/route.ts']) {
    const src = readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.ok(!/LARU_HP_API_SECRET|x-laru-secret|publication-target|draft|quota|generate/i.test(src.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '')), f);
  }
});
