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
// Publication Target（lifecycle 仕様 e953113 の形）。呼ばれた瞬間に HP の記事一覧の状態も記録する（順番の証明）
//   POST /__pt { mode: 'ok' | 'fail401' | 'fail409' | 'fail503' | 'flaky' , secret }
//   GET  /__pt → { calls: [{ action, body, auth, articlesStatus, at }] }
let PT = { mode: 'ok', secret: 'local-test-secret', calls: [], registered: {} , flaky: 0 };
let ENT = { mode: 'ok', calls: [], companies: {} };
const HP = process.env.HP_ORIGIN || 'http://127.0.0.1:3319';
async function articlesStatus(siteId) {
  const slug = { 'id-a': 'site-a', 'id-b': 'site-b' }[siteId];
  if (!slug) return null;
  try { const r = await fetch(`${HP}/hp/${slug}/articles`, { redirect: 'manual' }); return r.status; } catch { return -1; }
}
function readBody(req) { return new Promise((r) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => r(b)); }); }
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/__pt') {
    if (req.method === 'POST') { const b = JSON.parse((await readBody(req)) || '{}'); PT = { ...PT, ...b, calls: b.reset ? [] : PT.calls, registered: b.reset ? {} : PT.registered, flaky: 0 }; return send(res, 200, { ok: true }); }
    return send(res, 200, { calls: PT.calls, registered: PT.registered });
  }
  // HP バンドルの権利（/api/hp/entitlement）。LARUbot app/services/hp_entitlement.py apply_event と同じ判定
  //   POST /__ent { mode: 'ok' | 'fail503' | 'fail409', reset }  GET /__ent → { calls, companies }
  if (url.pathname === '/__ent') {
    if (req.method === 'POST') { const b = JSON.parse((await readBody(req)) || '{}'); ENT = { ...ENT, ...b, calls: b.reset ? [] : ENT.calls, companies: b.reset ? {} : ENT.companies }; return send(res, 200, { ok: true }); }
    return send(res, 200, { calls: ENT.calls, companies: ENT.companies });
  }
  if (url.pathname === '/api/hp/entitlement' && req.method === 'POST') {
    const body = JSON.parse((await readBody(req)) || '{}');
    const auth = req.headers['x-laru-secret'] === PT.secret;
    ENT.calls.push({ body, auth, articlesStatus: await articlesStatus(body.site_id), ptState: PT.registered[body.public_id]?.state ?? null, at: Date.now() });
    if (!auth) return send(res, 401, { code: 'unauthorized' });
    if (ENT.mode === 'fail503') return send(res, 503, { error: 'unavailable' });
    if (ENT.mode === 'fail409') return send(res, 409, { code: 'site_mismatch' });
    const PLANS = { hp: [null, false], 'hp-bot': ['starter', false], lite: ['lite', false], 'hp-bot-seo': ['starter', true], agency: ['lite', true] };
    if (!(body.plan in PLANS)) return send(res, 400, { code: 'invalid_plan' });
    if (!body.event_at) return send(res, 400, { code: 'event_at_required' });
    const c = ENT.companies[body.public_id] || {};
    if (c.hp_site_id && c.hp_site_id !== body.site_id) return send(res, 409, { code: 'site_mismatch' });
    const [plan, seo] = PLANS[body.plan];
    const t = Date.parse(body.event_at), prev = c.event_at ? Date.parse(c.event_at) : null;
    const entitlement = (x) => ({ plan: x.state === 'active' ? x.plan : null, bot: x.state === 'active' && !!x.plan, seo: x.state === 'active' && x.seo, hp: x });
    if (prev !== null && t < prev) return send(res, 200, { ok: true, applied: false, reason: 'stale', entitlement: entitlement(c) });
    if (prev === t && c.plan === plan && c.seo === seo && c.state === body.state) return send(res, 200, { ok: true, applied: false, reason: 'duplicate', entitlement: entitlement(c) });
    const next = { plan, seo, state: body.state, hp_plan: body.plan, event_at: body.event_at, hp_site_id: c.hp_site_id || body.site_id };
    ENT.companies[body.public_id] = next;
    // LARUbot 側も公開先を止める（SEO を外す → inactive、解約・削除 → retired）。戻すのは HP の reactivate
    const reg = PT.registered[body.public_id];
    if (reg && (body.state !== 'active')) reg.state = 'retired';
    else if (reg && !seo && reg.state === 'active') reg.state = 'inactive';
    return send(res, 200, { ok: true, applied: true, reason: 'applied', entitlement: entitlement(next) });
  }
  if (url.pathname === '/api/hp/seo/publication-target' && req.method === 'POST') {
    const body = JSON.parse((await readBody(req)) || '{}');
    const auth = req.headers['x-laru-secret'] === PT.secret;
    const call = { action: body.action, body: { ...body }, auth, articlesStatus: await articlesStatus(body.site_id), at: Date.now() };
    PT.calls.push(call);
    if (!auth) return send(res, 401, { error: 'unauthorized' });
    if (PT.mode === 'fail401') return send(res, 401, { error: 'unauthorized' });
    if (PT.mode === 'fail409') return send(res, 409, { error: 'site_in_use' });
    if (PT.mode === 'fail503') return send(res, 503, { error: 'unavailable' });
    if (PT.mode === 'flaky' && PT.flaky++ < 1) return send(res, 503, { error: 'unavailable' });
    const prev = PT.registered[body.public_id];
    if (body.action === 'reactivate') {
      if (!prev) return send(res, 409, { code: 'not_registered' });
      const next = { ...prev, state: 'active', canonical_base: body.canonical_base || prev.canonical_base };
      const changed = JSON.stringify(prev) !== JSON.stringify(next);
      PT.registered[body.public_id] = next;
      return send(res, 200, { ok: true, public_id: body.public_id, action: 'reactivate', changed, registration: { registered: true, ...next, redirects_to_hp: true } });
    }
    const state = body.action === 'register' ? 'active' : body.action === 'retire' ? 'retired' : 'inactive';
    if (!prev && body.action !== 'register') return send(res, 200, { ok: true, public_id: body.public_id, action: body.action, changed: false, registration: { registered: false, redirects_to_hp: false } });
    const next = body.action === 'register' ? { state, site_id: body.site_id, canonical_base: body.canonical_base, article_path: body.article_path } : { ...(prev || {}), state: prev?.state === 'retired' && body.action === 'deactivate' ? 'retired' : state };
    const changed = JSON.stringify(prev) !== JSON.stringify(next);
    PT.registered[body.public_id] = next;
    return send(res, 200, { ok: true, public_id: body.public_id, action: body.action, changed, registration: { registered: true, ...next, redirects_to_hp: next.state === 'active' } });
  }
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
