// Supabase(PostgREST)の応答を模した読み取り専用サーバ。外部へは出ない。
const http = require('http');
const SITES = [
  { id: 'id-a', slug: 'site-a', name: 'Aサロン', custom_domain: 'salon-a.example', published: true,
    published_html: '<h1>A_ONLY_SITE_BODY</h1>', seo_json: { title: 'Aサロン' }, settings_json: { products: [{ id:'pa', name:'A_PRODUCT', description:'', price: 1000, active: true, stock: null }] },
    updated_at: '2026-09-01T00:00:00Z', view_count: 0 },
  { id: 'id-b', slug: 'site-b', name: 'Bビストロ', custom_domain: 'bistro-b.example', published: true,
    published_html: '<h1>B_ONLY_SITE_BODY</h1>', seo_json: { title: 'Bビストロ' }, settings_json: { products: [{ id:'pb', name:'B_ONLY_PRODUCT', description:'', price: 2000, active: true, stock: null }] },
    updated_at: '2026-09-01T00:00:00Z', view_count: 0 },
  { id: 'id-c', slug: 'site-c', name: 'C（未公開）', custom_domain: null, published: false,
    published_html: '<h1>C_ONLY_SITE_BODY</h1>', seo_json: {}, settings_json: {},
    updated_at: '2026-09-01T00:00:00Z', view_count: 0 },
];
const POSTS = [
  { id: 'a-post', site_id: 'id-a', title: 'A_ONLY_ARTICLE', content: 'A_ONLY_CONTENT', category: null, image_url: null, published: true, published_at: '2026-09-01T00:00:00Z' },
  { id: 'b-post', site_id: 'id-b', title: 'B_ONLY_ARTICLE', content: 'B_ONLY_CONTENT', category: null, image_url: null, published: true, published_at: '2026-09-02T00:00:00Z' },
  { id: 'b-draft', site_id: 'id-b', title: 'B_DRAFT', content: 'x', category: null, image_url: null, published: false, published_at: '2026-09-03T00:00:00Z' },
];
// site_domains: そのサイトの確認済みホスト（主な公開URL以外も含む）
const SITE_DOMAINS = [
  { site_id: 'id-a', host: 'salon-a.example',     status: 'connected', redirects_to: null },
  { site_id: 'id-a', host: 'www.salon-a.example', status: 'connected', redirects_to: null },
  { site_id: 'id-a', host: 'old-salon.example',   status: 'alias',     redirects_to: 'salon-a.example' },
  { site_id: 'id-b', host: 'bistro-b.example',    status: 'connected', redirects_to: null },
  // 未公開サイトのホスト。転送も配信もしない
  { site_id: 'id-c', host: 'hidden.example',      status: 'connected', redirects_to: null },
  // 確認が終わっていないホスト。転送しない
  { site_id: 'id-a', host: 'pending.example',     status: 'pending_dns', redirects_to: null },
];
const TABLES = { sites: SITES, news_posts: POSTS, profiles: [] };

function match(row, key, spec) {
  const [op, ...rest] = String(spec).split('.');
  const v = rest.join('.');
  const rv = row[key];
  if (op === 'eq') return String(rv) === v || (v === 'true' && rv === true) || (v === 'false' && rv === false);
  if (op === 'is') return v === 'true' ? rv === true : v === 'false' ? rv === false : rv === null;
  if (op === 'neq') return String(rv) !== v;
  return true;
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const m = url.pathname.match(/^\/rest\/v1\/([a-z_]+)$/);
  const send = (code, body) => {
    res.writeHead(code, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  if (url.pathname.startsWith('/auth/')) return send(200, { user: null, data: { user: null } });

  // site_domains?host=eq.<host>&status=in.(...)&select=site_id,sites!inner(...)&sites.published=is.true
  if (url.pathname === '/rest/v1/site_domains') {
    const host = (url.searchParams.get('host') || '').replace(/^eq\./, '');
    const statusSpec = url.searchParams.get('status') || '';
    const allowed = (statusSpec.match(/^in\.\((.*)\)$/) || [, ''])[1].split(',').filter(Boolean);
    const needPublished = url.searchParams.get('sites.published') === 'is.true';
    const out = SITE_DOMAINS
      .filter(d => d.host === host)
      .filter(d => allowed.length === 0 || allowed.includes(d.status))
      .map(d => {
        const site = SITES.find(x => x.id === d.site_id);
        // !inner: 親が無い / 条件に合わない行は落ちる
        if (!site) return null;
        if (needPublished && site.published !== true) return null;
        return { site_id: d.site_id, sites: { slug: site.slug, custom_domain: site.custom_domain, published: site.published } };
      })
      .filter(Boolean);
    return send(200, out.slice(0, Number(url.searchParams.get('limit') || out.length)));
  }
  if (!m) return send(200, []);
  let rows = (TABLES[m[1]] || []).slice();
  for (const [k, val] of url.searchParams) {
    if (['select','limit','order','offset'].includes(k)) continue;
    rows = rows.filter(r => match(r, k, val));
  }
  const order = url.searchParams.get('order');
  if (order) {
    const [col, dir] = order.split('.');
    rows.sort((a, b) => String(a[col]).localeCompare(String(b[col])) * (dir === 'desc' ? -1 : 1));
  }
  const limit = url.searchParams.get('limit');
  if (limit) rows = rows.slice(0, Number(limit));
  const accept = req.headers.accept || '';
  if (accept.includes('vnd.pgrst.object')) {
    if (rows.length !== 1) return send(406, { message: 'not single' });
    return send(200, rows[0]);
  }
  send(200, rows);
}).listen(54999, '127.0.0.1', () => console.log('fixture on 54999'));
