// Supabase(PostgREST)の応答を模した読み取り専用サーバ。外部へは出ない。
const http = require('http');
const SITES = [
  { id: 'id-a', slug: 'site-a', name: 'Aサロン', custom_domain: 'salon-a.example', published: true,
    published_html: '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin=""><link href="https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;500;700;900&display=swap" rel="stylesheet"><style>body,input,textarea,select,button{font-family:\'Zen Kaku Gothic New\',-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif}</style><div class="lhp"><h1>A_ONLY_SITE_BODY 髪と、これからの時間を整える</h1><p>東京・国立の閑静な住宅街にある、完全予約制のヘアサロンです。一日にお迎えするお客様の人数を絞り、カウンセリングから仕上げまで担当者が一人で担当します。</p><h2>当店が大切にしていること</h2><p>髪質・骨格・生活習慣は一人ひとり違います。写真どおりに切ることよりも、翌朝ご自身で再現できるかどうかを基準にご提案しています。薬剤はダメージの少ないものを中心に取り揃え、頭皮の状態に合わせて調整します。</p><h2>メニューと料金</h2><ul><li>カット（シャンプー・ブロー込み）… 6,600円</li><li>カラー＋カット … 13,200円〜</li><li>デジタルパーマ＋カット … 16,500円〜</li><li>髪質改善トリートメント … 8,800円</li><li>ヘッドスパ（40分）… 5,500円</li></ul><h2>ご予約の流れ</h2><p>お電話またはウェブ予約フォームから、ご希望の日時を第三希望までお知らせください。当日は施術開始の五分前を目安にお越しいただけますと、ゆとりを持ってご案内できます。遅れる場合はご一報いただければ、可能な範囲で調整いたします。</p><h2>お客様の声</h2><p>「くせ毛で毎朝苦労していましたが、乾かすだけでまとまるようになりました」（三十代・会社員）</p><p>「白髪染めの頻度が減り、髪の負担が軽くなった実感があります」（五十代・自営業）</p><h2>アクセス</h2><p>JR中央線 国立駅 南口より徒歩八分。大学通りを直進し、二つ目の信号を右折してすぐ。近隣にコインパーキングがございます。営業時間は十時から十九時、火曜定休です。</p></div>', seo_json: { title: 'Aサロン' }, settings_json: { products: [{ id:'pa', name:'A_PRODUCT', description:'', price: 1000, active: true, stock: null }] },
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
// 基準作品（美容室）。保存済みの状態で置いてある。
// docs/reference-sites/salon/publish-check.mjs が、ここから
// 実際の公開ルートを通して published_html を書き、公開URLで表示させる。
// 基準作品（美容室）。保存済みの状態で置いてある。
// 中身は docs/reference-sites/salon/site.json をそのまま読む。
// 以前はこのファイルへ写していたが、片方だけ直して食い違うので、1か所にした。
const SALON_SEED = require('../../docs/reference-sites/salon/site.json');
const SALON = {
  id: 'a3f1c0de-5b47-4e2a-9c31-7d8e6f0b2a54',
  user_id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  custom_domain: null,
  published: true,
  published_html: '',
  updated_at: '2026-09-10T00:00:00Z',
  view_count: 0,
  ...SALON_SEED,
};
SITES.push(SALON);

// 「サイト全体の設定」が無い、以前からある作品。
// 新しい設定を暗黙に足していないこと（開いて直して保存しても増えないこと）を
// 確かめるために置いてある。design も designPreset も持たない。
const LEGACY = {
  id: 'd41d8cd9-8f00-4b20-a204-9800998ecf84',
  user_id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  slug: 'kyuu-site',
  name: '以前からある作品',
  custom_domain: null,
  published: true,
  published_html: '',
  updated_at: '2026-09-10T00:00:00Z',
  view_count: 0,
  industry: 'beauty',
  blocks_json: { v: 2, pages: [{ id: 'page-main', name: 'トップページ', path: '/', blocks: [
    { id: 'lb-hero', type: 'hero', data: { heading: '以前からある見出し', subheading: '設定を持たない作品', ctaText: 'お問い合わせ', ctaLink: '#contact' } },
    { id: 'lb-text', type: 'paragraph', data: { text: 'ここは本文です。', align: 'left' } },
  ] }] },
  seo_json: { title: '以前からある作品', description: '設定を持たない作品', keywords: '', ogImage: '' },
  settings_json: {
    colorScheme: 'professional-blue', designStyle: 'modern', fontFamily: 'noto',
    accentColor: '#c2410c', heroLayout: 'center', headerStyle: 'solid', animLevel: 'subtle',
    customCss: '.lhp-hero h1{letter-spacing:.08em}',
  },
};
SITES.push(LEGACY);

// 受信した問い合わせ・予約。/api/contact が insert する先。
const CONTACTS = [];
const TABLES = { sites: SITES, news_posts: POSTS, contacts: CONTACTS, profiles: [
  { id: '4f2a1b8c-3d5e-4a6f-8b1c-2e3d4f5a6b7c', subscription_status: 'active' },
  { id: '7c9e6679-7425-40de-944b-e07fc1f90ae7', subscription_status: 'active' },
] };
// auth.users の代わり。/api/contact は site.user_id から通知先メールを引く。
const USERS = {
  '7c9e6679-7425-40de-944b-e07fc1f90ae7': { id: '7c9e6679-7425-40de-944b-e07fc1f90ae7', email: 'owner@example.com', aud: 'authenticated', role: 'authenticated' },
  '4f2a1b8c-3d5e-4a6f-8b1c-2e3d4f5a6b7c': { id: '4f2a1b8c-3d5e-4a6f-8b1c-2e3d4f5a6b7c', email: 'admin@example.com', aud: 'authenticated', role: 'authenticated' },
};

function match(row, key, spec) {
  const raw = String(spec);
  // not.like.* など。偽データを絞る意味がないので素通しする
  if (raw.startsWith('not.')) return true;
  const [op, ...rest] = raw.split('.');
  const v = rest.join('.');
  const rv = row[key];
  if (op === 'eq') return String(rv) === v || (v === 'true' && rv === true) || (v === 'false' && rv === false);
  if (op === 'is') return v === 'true' ? rv === true : v === 'false' ? rv === false : rv === null;
  if (op === 'neq') return String(rv) !== v;
  return true;
}

/* 検査から操作する切り替え。
   「保存できなかったとき」「保存の途中で別の画面が更新したとき」を
   本物の失敗として起こすために使う。応答の差し替えではなく、
   ここが実際に失敗を返すので、アプリ側の経路はそのまま通る。 */
const CONTROL = { failWrites: false, beforeUpdate: null };

/** 更新のたびに進む時刻。同じミリ秒で2回呼ばれても必ず進む */
let lastTouch = 0;
function touch() {
  const now = Math.max(Date.now(), lastTouch + 1);
  lastTouch = now;
  return new Date(now).toISOString();
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const m = url.pathname.match(/^\/rest\/v1\/([a-z_]+)$/);
  const send = (code, body) => {
    res.writeHead(code, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };

  if (url.pathname === '/__control') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      if (req.method === 'POST') {
        let next = {};
        try { next = JSON.parse(body || '{}'); } catch { /* noop */ }
        if ('failWrites' in next) CONTROL.failWrites = !!next.failWrites;
        if ('beforeUpdate' in next) CONTROL.beforeUpdate = next.beforeUpdate;
      }
      send(200, CONTROL);
    });
    return;
  }
  // 認証。利用者のセッションを持ってきたら、その利用者を返す。
  // 持っていなければ未ログイン（公開ルートの認可を確かめられるように）。
  if (url.pathname.startsWith('/auth/')) {
    const auth = req.headers.authorization || '';
    const token = auth.replace(/^Bearer\s+/i, '');
    const known = token && token !== 'anon-stub' && token !== 'service-stub';
    // service role からの利用者引き当て（auth.admin.getUserById）
    const adm = url.pathname.match(/^\/auth\/v1\/admin\/users\/([^/]+)$/);
    if (adm) {
      const u = USERS[decodeURIComponent(adm[1])];
      return u ? send(200, u) : send(404, { message: 'User not found' });
    }
    if (url.pathname.endsWith('/user')) {
      if (!known) return send(401, { message: 'invalid claim: missing sub claim' });
      return send(200, { id: '7c9e6679-7425-40de-944b-e07fc1f90ae7', email: 'owner@example.com', aud: 'authenticated', role: 'authenticated' });
    }
    return send(200, { user: null, data: { user: null } });
  }

  // 書き込み。公開ルートが published_html を保存できるようにする。
  if (req.method === 'PATCH' || req.method === 'POST') {
    const t = (url.pathname.match(/^\/rest\/v1\/([a-z_]+)$/) || [])[1];
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      let patch = {};
      try { patch = JSON.parse(body || '{}'); } catch { /* noop */ }
      // PostgREST は Accept: vnd.pgrst.object+json のとき1件だけを返す。
      // supabase-js の .single() がこれを使うので、同じように答える。
      const single = (req.headers.accept || '').includes('vnd.pgrst.object');
      const out = (rows, code) => {
        if (!single) return send(code, rows);
        if (rows.length !== 1) return send(406, { message: 'JSON object requested, multiple (or no) rows returned' });
        return send(code, rows[0]);
      };
      if (t === 'sites' && req.method === 'PATCH') {
        if (CONTROL.failWrites) return send(500, { message: 'fixture: 書き込みを失敗させています' });
        /* 読み取りと書き込みのあいだに、別の画面が更新した状況を作る。
           一度だけ効く。合成の元が古くなるので、上書きが起きるなら露見する。 */
        if (CONTROL.beforeUpdate) {
          const { id, settings_json } = CONTROL.beforeUpdate;
          const left = (CONTROL.beforeUpdate.times ?? 1) - 1;
          CONTROL.beforeUpdate = left > 0 ? { ...CONTROL.beforeUpdate, times: left } : null;
          const target = SITES.find(x => x.id === id);
          if (target) {
            target.settings_json = { ...target.settings_json, ...settings_json };
            target.updated_at = touch();
          }
        }
        let rows = SITES.slice();
        for (const [k, val] of url.searchParams) {
          if (['select', 'limit', 'order', 'offset'].includes(k)) continue;
          rows = rows.filter(r => match(r, k, val));
        }
        // 本番の sites には、更新のたびに updated_at を進める仕掛けがある。
        // 同時更新の検出はこの値で行うので、偽物でも同じように進める。
        rows.forEach(r => Object.assign(r, patch, { updated_at: touch() }));
        return out(rows, 200);
      }
      if (t === 'contacts' && req.method === 'POST') {
        const rows = (Array.isArray(patch) ? patch : [patch]).map((r, i) => ({
          id: `contact-${CONTACTS.length + i + 1}`, created_at: new Date().toISOString(), ...r,
        }));
        CONTACTS.push(...rows);
        return out(rows, 201);
      }
      // site_versions などは受け取るだけ
      return out(Array.isArray(patch) ? patch : [patch], 201);
    });
    return;
  }

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
}).listen(Number(process.env.FIXTURE_PORT || 54999), '127.0.0.1', function () {
  console.log('fixture on ' + this.address().port);
});
