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

test('API・_next は顧客ホストでも素通しする', async () => {
  assert.equal((await route('salon-a.example', '/api/pageview')).to, null);
  assert.equal((await route('salon-a.example', '/_next/static/x.js')).to, null);
});

test('顧客ホストからプレビューや管理画面へ入れない', async () => {
  // /laruHP は proxy の書き換え対象外だが、顧客ホストでは
  // そのまま管理画面が出てはいけない。ここでは書き換えが
  // 起きないこと（＝顧客サイトとして解決されないこと）を固定する。
  const r = await route('salon-a.example', '/laruHP/dashboard');
  assert.equal(r.to, null);
  // /hp/preview/<token> も顧客サイト配下には写さない
  const p = await route('salon-a.example', '/hp/preview/tok');
  assert.equal(p.to, null);
});

test.after(() => restore());
