// LARU SEO の記事提供 API（Content API）の代わり。手元の確認専用（実サービスへは出ない）。
// 応答の形は LARUbot_homepage docs/integrations/laru_hp_seo_article_contract.md と、本番の実際の応答（2026-10-04）に合わせる。
//   POST /__state { tenants: { <public_id>: { publication, items:[...], details: { <slug>: {status, body} } } } }
//   GET  /__state  → { calls, conditional }
const http = require('http');
const crypto = require('crypto');
let STATE = { tenants: {} };
let calls = 0, conditional = 0;
const send = (res, status, body, extra = {}) => {
  res.writeHead(status, { 'Content-Type': 'application/json', ...extra });
  res.end(body === null ? '' : JSON.stringify(body));
};
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/__state') {
    if (req.method === 'POST') {
      let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { STATE = JSON.parse(b || '{}'); calls = 0; conditional = 0; send(res, 200, { ok: true }); });
      return;
    }
    return send(res, 200, { calls, conditional });
  }
  const m = url.pathname.match(/^\/api\/seo\/content\/([^/]+)(?:\/([^/]+))?$/);
  if (!m) return send(res, 404, { error: 'not_found' }, { 'Cache-Control': 'no-store' });
  calls++;
  const t = STATE.tenants[decodeURIComponent(m[1])];
  if (!t) return send(res, 404, { error: 'not_found' }, { 'Cache-Control': 'no-store' });
  let status = 200, body;
  if (m[2]) {
    const d = (t.details || {})[decodeURIComponent(m[2])];
    if (!d) return send(res, 404, { error: 'not_found' }, { 'Cache-Control': 'no-store' });
    status = d.status || 200;
    body = status === 200 ? { ...d.body, publication: t.publication } : d.body;
    if (status !== 200) return send(res, status, body, { 'Cache-Control': 'no-store' });
  } else {
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 20));
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
    const items = t.items || [];
    body = { total: items.length, page, limit, has_next: page * limit < items.length, items: items.slice((page - 1) * limit, page * limit), publication: t.publication };
  }
  const etag = `"${crypto.createHash('md5').update(JSON.stringify(body)).digest('hex')}"`;
  if (req.headers['if-none-match'] === etag) { conditional++; return send(res, 304, null, { ETag: etag }); }
  send(res, status, body, { ETag: etag, 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600', 'Last-Modified': new Date().toUTCString() });
}).listen(Number(process.env.SEO_MOCK_PORT || 54997), '127.0.0.1');
