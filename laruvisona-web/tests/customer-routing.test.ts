// 顧客公開サイトのルーティングを、実際の proxy() に
// 本物の NextRequest を通して検証する。
//
// 監督レビュー(435fe95) C1:
//   - トップ・ショップ・記事・404 が、各公開URLで正しく解決されること
//   - クエリが保持されること
//   - A/B 2サイトで内容が混ざらないこと
//   - 未知のパス・未知のホストがトップページ200にならないこと
//
// Supabase への参照（service role の REST 呼び出し）は fetch を差し替える。
// 外部ネットワークへは出ない。

import assert from 'node:assert/strict';
import test from 'node:test';

process.env.NEXT_PUBLIC_APP_URL = 'https://laruvisona.jp';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://stub.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-stub';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-stub';

const { NextRequest } = await import('next/server');

/** custom_domain → slug の対応（本番の sites テーブルの代わり） */
const DOMAIN_TO_SLUG: Record<string, string> = {
  'salon-a.example': 'site-a',
  'bistro-b.example': 'site-b',
};

/**
 * site_domains の代わり。
 * host → { slug, custom_domain } （そのホストが属するサイトの情報）。
 * status は connected/legacy/alias のいずれかで登録済みという想定。
 */
const ALIAS_HOSTS: Record<string, { slug: string; custom_domain: string | null }> = {
  'www.salon-a.example': { slug: 'site-a', custom_domain: 'salon-a.example' },
  // 旧ドメイン。いまの主な公開URLは salon-a.example
  'old-salon.example': { slug: 'site-a', custom_domain: 'salon-a.example' },
  // 独自ドメインを持たないサイトの旧ホスト → 標準URLへ返す
  'legacy-c.example': { slug: 'site-c', custom_domain: null },
  // 壊れた登録（自分自身が主URL扱い）→ 輪になるので転送しない
  'loop.example': { slug: 'site-a', custom_domain: 'loop.example' },
};

function installFetchStub() {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    // sites?custom_domain=eq.<host>&published=is.true&select=slug
    if (url.pathname.endsWith('/rest/v1/sites')) {
      const eq = url.searchParams.get('custom_domain') || '';
      const host = eq.replace(/^eq\./, '');
      const slug = DOMAIN_TO_SLUG[host];
      return new Response(JSON.stringify(slug ? [{ slug }] : []), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    }
    // site_domains?host=eq.<host>&status=in.(...)&select=site_id,sites!inner(...)
    if (url.pathname.endsWith('/rest/v1/site_domains')) {
      const host = (url.searchParams.get('host') || '').replace(/^eq\./, '');
      const hit = ALIAS_HOSTS[host];
      // 主な公開URLとして配信中のホストは、ここでは返さない
      return new Response(
        JSON.stringify(hit ? [{ site_id: 'x', sites: { slug: hit.slug, custom_domain: hit.custom_domain, published: true } }] : []),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    // profiles?agency_admin_domain=... （代理店ドメインは無し）
    if (url.pathname.endsWith('/rest/v1/profiles')) {
      return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
    }
    // Supabase auth（proxy の getUser）
    return new Response(JSON.stringify({ data: { user: null } }), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  return () => { globalThis.fetch = original; };
}

const restore = installFetchStub();
const { proxy } = await import('../proxy.ts');

/** proxy を通した結果を、分かりやすい形にする */
async function route(host: string, path: string) {
  const req = new NextRequest(new URL(`https://${host}${path}`), {
    headers: { host },
  });
  const res = await proxy(req);
  const rewrite = res.headers.get('x-middleware-rewrite');
  return {
    status: res.status,
    // 内部で書き換えられた先（rewrite が無ければ素通し）
    to: rewrite ? new URL(rewrite).pathname : null,
    search: rewrite ? new URL(rewrite).search : null,
    location: res.headers.get('location'),
  };
}

test('独自ドメイン: トップは そのサイトの /hp/<slug> へ', async () => {
  const r = await route('salon-a.example', '/');
  assert.equal(r.to, '/hp/site-a');
});

test('独自ドメイン: 下層パスが独立したページとして解決される', async () => {
  assert.equal((await route('salon-a.example', '/shop')).to, '/hp/site-a/shop');
  assert.equal((await route('salon-a.example', '/post/abc123')).to, '/hp/site-a/post/abc123');
});

test('独自ドメイン: クエリが保持される', async () => {
  const r = await route('salon-a.example', '/shop?lang=en&utm_source=review');
  assert.equal(r.to, '/hp/site-a/shop');
  assert.equal(r.search, '?lang=en&utm_source=review');
});

test('独自ドメイン: robots.txt / sitemap.xml も同じサイトのものへ', async () => {
  assert.equal((await route('salon-a.example', '/robots.txt')).to, '/hp/site-a/robots.txt');
  assert.equal((await route('salon-a.example', '/sitemap.xml')).to, '/hp/site-a/sitemap.xml');
});

test('独自ドメイン: 未知のパスをトップページに読み替えない', async () => {
  // 以前はどのパスでもトップが 200 で返っていた（ソフト404）。
  // いまは存在しないルートへ渡すので、Next.js が 404 を返す。
  const r = await route('salon-a.example', '/does-not-exist');
  assert.equal(r.to, '/hp/site-a/does-not-exist');
  assert.notEqual(r.to, '/hp/site-a', 'トップへ読み替えている');
});

test('未知のホストはトップページを返さず 404', async () => {
  const r = await route('unknown-host.example', '/');
  assert.equal(r.status, 404);
  assert.equal(r.to, null, '未知のホストを何かのサイトへ写している');
});

test('A/B: 同じパスでもサイトごとに別のページへ解決される', async () => {
  const a = await route('salon-a.example', '/shop');
  const b = await route('bistro-b.example', '/shop');
  assert.equal(a.to, '/hp/site-a/shop');
  assert.equal(b.to, '/hp/site-b/shop');
  assert.notEqual(a.to, b.to);
});

test('A/B: Aのホストに渡した記事IDは、Aのサイト配下でしか解決されない', async () => {
  // ルーティング段階で slug が確定するので、
  // 記事の所属確認（site_id 一致）はページ側で行う。
  const r = await route('salon-a.example', '/post/b-only-post-id');
  assert.equal(r.to, '/hp/site-a/post/b-only-post-id');
  assert.ok(!r.to.includes('site-b'), '別サイトのルートへ渡している');
});

test('サブドメイン形式も同じルートへ、サブパスごと渡す', async () => {
  assert.equal((await route('site-a.laruvisona.jp', '/')).to, '/hp/site-a');
  assert.equal((await route('site-a.laruvisona.jp', '/shop')).to, '/hp/site-a/shop');
  assert.equal((await route('site-a.laruvisona.jp', '/post/x')).to, '/hp/site-a/post/x');
});

test('会社ホストは書き換えない（パス形式はそのまま）', async () => {
  const r = await route('laruvisona.jp', '/hp/site-a/shop');
  assert.equal(r.to, null, '会社ホストのパスを書き換えている');
});

test('API・_next は顧客ホストでも素通しする（POSTを巻き込まない）', async () => {
  assert.equal((await route('salon-a.example', '/api/pageview')).to, null);
  assert.equal((await route('salon-a.example', '/_next/static/x.js')).to, null);
});

test('顧客ホストから内部パスで別サイトを指定できない', async () => {
  // ここが以前の穴。/hp を素通ししていたため、Aのドメインから
  // /hp/site-b/post/<id> を開くとBの記事が200で表示できた。
  // 「書き換えが無い」ことは遮断の証拠にならないので、
  // どこへ写るかを確認する（存在しないルート＝404になる）。
  for (const path of ['/hp/site-b/post/b-post', '/hp/site-b/shop', '/hp/site-b']) {
    const r = await route('salon-a.example', path);
    assert.equal(r.to, `/hp/site-a${path}`, `素通ししている: ${path}`);
    assert.ok(!r.to.startsWith('/hp/site-b'), `別サイトのルートへ渡している: ${path}`);
  }
});

test('公開済みHTMLの旧い記事リンクは、転送だけ通す', async () => {
  // /hp/post/<id> は本文を描画せず、その記事のサイトの正規URLへ308する。
  // 別サイトの本文がこのホストに出ることはないので、素通ししてよい。
  const r = await route('salon-a.example', '/hp/post/b-post');
  assert.equal(r.to, null, '転送経路まで潰している');
  // 記事一覧のような別の /hp パスは通さない
  assert.equal((await route('salon-a.example', '/hp/post/b-post/extra')).to,
    '/hp/site-a/hp/post/b-post/extra');
  assert.equal((await route('salon-a.example', '/hp/preview/tok')).to, '/hp/site-a/hp/preview/tok');
});

test('顧客ホストから管理画面・プレビューへ入れない', async () => {
  const admin = await route('salon-a.example', '/laruHP/dashboard');
  assert.equal(admin.to, '/hp/site-a/laruHP/dashboard', '管理画面を素通ししている');
  const preview = await route('salon-a.example', '/hp/preview/tok');
  assert.equal(preview.to, '/hp/site-a/hp/preview/tok', 'プレビューを素通ししている');
  const builder = await route('salon-a.example', '/laruHP/builder/x');
  assert.equal(builder.to, '/hp/site-a/laruHP/builder/x');
});

test('会社ホストではパス形式がそのまま通る', async () => {
  assert.equal((await route('laruvisona.jp', '/hp/site-b/post/b-post')).to, null);
  assert.equal((await route('laruvisona.jp', '/laruHP/dashboard')).to, null);
});

test('割当を変えたら、次のリクエストから新しいサイトへ向く', async () => {
  // 以前は5分キャッシュのため、割当を A→B に変えても旧Aへ案内し続けた。
  assert.equal((await route('salon-a.example', '/shop')).to, '/hp/site-a/shop');
  DOMAIN_TO_SLUG['salon-a.example'] = 'site-b';
  try {
    assert.equal((await route('salon-a.example', '/shop')).to, '/hp/site-b/shop',
      '古い割当を使い続けている');
  } finally {
    DOMAIN_TO_SLUG['salon-a.example'] = 'site-a';
  }
});

test('割当を解除したら、次のリクエストから404になる', async () => {
  assert.equal((await route('salon-a.example', '/')).to, '/hp/site-a');
  delete DOMAIN_TO_SLUG['salon-a.example'];
  try {
    const r = await route('salon-a.example', '/');
    assert.equal(r.status, 404, '解除後も旧サイトへ案内している');
  } finally {
    DOMAIN_TO_SLUG['salon-a.example'] = 'site-a';
  }
});

test('接続直後は、否定結果を持ち越さずに解決できる', async () => {
  // 未登録のホストを一度引いたあと、登録された場合。
  // 否定キャッシュがあると数分間404が続いていた。
  assert.equal((await route('new-shop.example', '/')).status, 404);
  DOMAIN_TO_SLUG['new-shop.example'] = 'site-b';
  try {
    assert.equal((await route('new-shop.example', '/')).to, '/hp/site-b');
  } finally {
    delete DOMAIN_TO_SLUG['new-shop.example'];
  }
});

test('DB照会に失敗したホストを、どこかのサイトへ解決しない', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => { throw new Error('db down'); }) as typeof fetch;
  try {
    const r = await route('salon-a.example', '/');
    assert.equal(r.status, 404);
    assert.equal(r.to, null);
  } finally { globalThis.fetch = original; }
});

test.after(() => restore());


// ── 別名ホスト（apex/www のもう一方、旧ドメイン） ────────────────

test('別名ホスト: 主な公開URLへ308で転送する', async () => {
  const r = await route('www.salon-a.example', '/');
  assert.equal(r.status, 308);
  assert.equal(r.location, 'https://salon-a.example/');
  assert.equal(r.to, null, '転送すべきホストを配信している');
});

test('別名ホスト: 下層パスとクエリをそのまま保つ', async () => {
  const a = await route('www.salon-a.example', '/shop');
  assert.equal(a.location, 'https://salon-a.example/shop');

  const b = await route('www.salon-a.example', '/post/abc123?utm_source=review&lang=en');
  assert.equal(b.location, 'https://salon-a.example/post/abc123?utm_source=review&lang=en');
});

test('旧ドメインも、いまの主な公開URLへ転送する', async () => {
  const r = await route('old-salon.example', '/shop?x=1');
  assert.equal(r.status, 308);
  assert.equal(r.location, 'https://salon-a.example/shop?x=1');
});

test('別名ホスト: 独自ドメインが無いサイトは標準URLへ返す', async () => {
  const r = await route('legacy-c.example', '/shop');
  assert.equal(r.status, 308);
  assert.equal(r.location, 'https://laruvisona.jp/hp/site-c/shop');
});

test('別名ホスト: 自分自身へは転送しない（輪にならない）', async () => {
  const r = await route('loop.example', '/');
  assert.equal(r.status, 404);
  assert.equal(r.location, null, '自分自身へ転送している');
});

test('別名ホスト: 別サイトへは決して転送しない', async () => {
  // 転送先は「そのホストが属するサイト」の正規URLからしか作らない。
  // 観測値（redirects_to）は配信の宛先に使わない。
  const r = await route('www.salon-a.example', '/post/b-only-post-id');
  assert.ok(r.location?.startsWith('https://salon-a.example/'), r.location ?? 'no location');
  assert.ok(!r.location?.includes('bistro-b.example'), '別サイトへ転送している');
  assert.ok(!r.location?.includes('site-b'), '別サイトへ転送している');
});

test('主な公開URLになったホストは、転送ではなく配信する', async () => {
  // 主URLの照会が先。別名の照会に落ちない。
  const r = await route('salon-a.example', '/shop');
  assert.equal(r.to, '/hp/site-a/shop');
  assert.equal(r.location, null, '主URLを転送している');
});

test('別名ホストでも API・_next は転送せず素通しする', async () => {
  // 所有確認の往復（/api/domain-probe）と静的配信を壊さない
  assert.equal((await route('www.salon-a.example', '/api/domain-probe?host=x')).location, null);
  assert.equal((await route('www.salon-a.example', '/_next/static/x.js')).location, null);
});
