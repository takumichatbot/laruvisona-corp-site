// 申し込み〜決済の検証に使う、外部サービスの替え玉。外部へは一切出ない。
//
//   54999番 … Supabase（PostgREST と GoTrue）
//     NEXT_PUBLIC_SUPABASE_URL はビルド時に埋め込まれるので、
//     tests/http と同じ番号から動かせない。
//   54998番 … Stripe / Resend（メール） / LARUbot / 検証用の操作口
//
// ここが返すものは、実物の応答のうち**このリポジトリのコードが読む項目だけ**。
// 足りない項目が要るようになったら、実物の応答を見て足すこと。
const http = require('http');

const SUPABASE_PORT = Number(process.env.BILLING_SUPABASE_PORT || 54999);
const SERVICES_PORT = Number(process.env.BILLING_SERVICES_PORT || 54998);

const USER_ID = '11111111-1111-4111-8111-111111111111';
const ADMIN_USER_ID = '22222222-2222-4222-8222-222222222222';
const SITE_ID = '33333333-3333-4333-8333-333333333333';

const initialState = () => ({
  users: {
    [USER_ID]: { id: USER_ID, email: 'customer@example.test' },
    [ADMIN_USER_ID]: { id: ADMIN_USER_ID, email: 'owner@example.test' },
  },
  profiles: [
    {
      id: USER_ID, email: 'customer@example.test', plan: null, subscription_status: 'inactive',
      stripe_customer_id: null, stripe_subscription_id: null,
      contract_starts_at: null, contract_ends_at: null,
      is_suspended: false, features: null, admin_notes: null,
      google_refresh_token: null, retention_emails_sent: null,
    },
    {
      id: ADMIN_USER_ID, email: 'owner@example.test', plan: null, subscription_status: 'inactive',
      stripe_customer_id: null, stripe_subscription_id: null,
      contract_starts_at: null, contract_ends_at: null,
      is_suspended: false, features: null, admin_notes: null,
      google_refresh_token: null, retention_emails_sent: null,
    },
  ],
  sites: [{ id: SITE_ID, user_id: USER_ID, name: 'テスト工務店', published: false, settings_json: {} }],
  hp_members: [],
  hp_reservations: [],
  // 呼ばれた外部サービスの記録。検証はこれを見る。
  calls: { larubot: [], email: [], stripe: [] },
});

let state = initialState();

/** Stripe側の作り置き。実物の項目名に合わせる。 */
const SUBSCRIPTIONS = {
  sub_test_hp: {
    id: 'sub_test_hp', object: 'subscription', status: 'active', customer: 'cus_test',
    // start_date（契約が始まった日）と current_period_start（いまの請求期間の頭）を
    // わざと別の値にしてある。同じ値だと、どちらを見ているか区別できない。
    start_date: 1789000000,            // 契約開始
    current_period_start: 1791592000,  // 2回目の請求期間の頭（1ヶ月後）
    current_period_end: 1794184000,    // その終わり
    items: { object: 'list', data: [{ id: 'si_1', price: { id: 'price_hp', unit_amount: 999 } }] },
    metadata: {},
  },
};

const PRICES = {
  price_hp: { id: 'price_hp', object: 'price', unit_amount: 999, currency: 'jpy', active: true, recurring: { interval: 'month' } },
};

const COUPONS = {
  coupon_first_month: { id: 'coupon_first_month', object: 'coupon', percent_off: 100, amount_off: null, duration: 'once', valid: true },
};

function send(res, status, body, contentType = 'application/json') {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, { 'content-type': contentType, 'content-length': Buffer.byteLength(payload) });
  res.end(payload);
}

function readBody(req) {
  return new Promise(resolve => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

/** PostgREST の ?col=eq.value 形式。このリポジトリが使うのは eq だけ。 */
function matches(row, params) {
  for (const [key, raw] of params) {
    if (['select', 'order', 'limit', 'offset'].includes(key)) continue;
    if (!raw.startsWith('eq.')) return false;
    const want = raw.slice(3);
    const got = row[key];
    if (want === 'null') { if (got !== null && got !== undefined) return false; continue; }
    if (String(got) !== want) return false;
  }
  return true;
}

/** .single() / .maybeSingle() は配列ではなく単体を期待する */
const wantsObject = req => String(req.headers.accept || '').includes('vnd.pgrst.object');

function pickColumns(row, select) {
  if (!select || select === '*') return { ...row };
  const out = {};
  for (const part of select.split(',')) {
    const name = part.trim().split(':')[0].trim();
    if (!name || name.includes('(')) continue;
    out[name] = row[name];
  }
  return out;
}

const supabase = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const params = [...url.searchParams.entries()];

  // GoTrue: auth.admin.getUserById
  const adminUser = url.pathname.match(/^\/auth\/v1\/admin\/users\/([^/]+)$/);
  if (adminUser) {
    const user = state.users[adminUser[1]];
    if (!user) return send(res, 404, { message: 'user not found' });
    return send(res, 200, user);
  }

  const table = url.pathname.match(/^\/rest\/v1\/([a-z_]+)$/)?.[1];
  if (!table) return send(res, 404, { message: 'not found' });
  if (!state[table]) return send(res, 404, { message: `relation "${table}" does not exist` });

  const select = url.searchParams.get('select');

  if (req.method === 'GET') {
    const rows = state[table].filter(row => matches(row, params)).map(row => pickColumns(row, select));
    if (wantsObject(req)) {
      if (rows.length !== 1) return send(res, 406, { message: 'expected exactly one row' });
      return send(res, 200, rows[0]);
    }
    return send(res, 200, rows);
  }

  if (req.method === 'PATCH') {
    const patch = JSON.parse((await readBody(req)) || '{}');
    const hit = state[table].filter(row => matches(row, params));
    for (const row of hit) Object.assign(row, patch);
    const rows = hit.map(row => pickColumns(row, select));
    if (wantsObject(req)) {
      if (rows.length !== 1) return send(res, 406, { message: 'expected exactly one row' });
      return send(res, 200, rows[0]);
    }
    return send(res, 200, rows);
  }

  if (req.method === 'POST') {
    const body = JSON.parse((await readBody(req)) || '{}');
    const incoming = Array.isArray(body) ? body : [body];
    for (const row of incoming) state[table].push({ ...row });
    return send(res, 201, incoming.map(row => pickColumns(row, select)));
  }

  return send(res, 405, { message: 'method not allowed' });
});

const services = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const body = ['POST', 'PATCH', 'PUT'].includes(req.method) ? await readBody(req) : '';

  // ── 検証用の操作口 ──
  if (url.pathname === '/__reset') { state = initialState(); return send(res, 200, { ok: true }); }
  if (url.pathname === '/__state') return send(res, 200, state);
  if (url.pathname === '/__ids') return send(res, 200, { userId: USER_ID, adminUserId: ADMIN_USER_ID, siteId: SITE_ID });

  // ── LARUbot ──
  if (url.pathname === '/larubot/api/hp/register') {
    state.calls.larubot.push({ secretSent: !!req.headers['x-laru-secret'], body: JSON.parse(body || '{}') });
    return send(res, 200, { ok: true });
  }

  // ── Resend（メール） ──
  if (url.pathname === '/emails') {
    const parsed = JSON.parse(body || '{}');
    state.calls.email.push({
      to: parsed.to, subject: parsed.subject,
      idempotencyKey: req.headers['idempotency-key'] || null,
      html: parsed.html || '',
    });
    return send(res, 200, { id: `email_${state.calls.email.length}` });
  }

  // ── Stripe ──
  if (url.pathname.startsWith('/v1/')) {
    state.calls.stripe.push({ method: req.method, path: url.pathname, body });
    const sub = url.pathname.match(/^\/v1\/subscriptions\/([^/]+)$/);
    if (sub && req.method === 'GET') {
      const found = SUBSCRIPTIONS[sub[1]];
      if (!found) return send(res, 404, { error: { message: 'No such subscription' } });
      return send(res, 200, found);
    }
    const price = url.pathname.match(/^\/v1\/prices\/([^/]+)$/);
    if (price) {
      const found = PRICES[price[1]];
      if (!found) return send(res, 404, { error: { message: 'No such price' } });
      return send(res, 200, found);
    }
    const coupon = url.pathname.match(/^\/v1\/coupons\/([^/]+)$/);
    if (coupon) {
      const found = COUPONS[coupon[1]];
      if (!found) return send(res, 404, { error: { message: 'No such coupon' } });
      return send(res, 200, found);
    }
    if (url.pathname === '/v1/customers' && req.method === 'POST') {
      return send(res, 200, { id: 'cus_test', object: 'customer' });
    }
    if (url.pathname === '/v1/subscriptions' && req.method === 'GET') {
      return send(res, 200, { object: 'list', data: [], has_more: false });
    }
    if (url.pathname === '/v1/checkout/sessions' && req.method === 'POST') {
      return send(res, 200, { id: 'cs_test', object: 'checkout.session', url: 'https://checkout.stripe.test/cs_test' });
    }
    return send(res, 404, { error: { message: `fixture does not implement ${url.pathname}` } });
  }

  return send(res, 404, { message: 'not found' });
});

supabase.listen(SUPABASE_PORT, '127.0.0.1', () => console.log(`supabase fixture on ${SUPABASE_PORT}`));
services.listen(SERVICES_PORT, '127.0.0.1', () => console.log(`services fixture on ${SERVICES_PORT}`));
