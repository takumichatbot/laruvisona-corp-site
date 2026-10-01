// 公開済みの文章Aと、未公開の下書き文章Bが違うサイトで、
// 「通常の閲覧」と「古い版の公開HTMLの一括再生成（/api/admin/republish-all）」が
// 未公開の文章Bを公開側へ出さないことを、本番用ビルドの実API経路で確かめる。
//
//   起動: FIXTURE_PORT=54999 node tests/http/fixture.cjs
//         ADMIN_SECRET=<手元だけの値> npx next start -p 3319   （fixture 向けにビルドしたもの）
//   実行: ADMIN_SECRET=<同じ値> node tests/http/republish-draft-check.mjs
//
// 利用者の操作（下書き保存・公開）は、通常ユーザーのログイン（fixture の利用者）で
// PUT /api/sites/[id] と POST /api/sites/[id]/publish を通す。管理者の直接更新は使わない。
// fixture へ直接書くのは「公開HTMLを古い版の印にする」準備だけ。
const base = process.env.BASE || 'http://127.0.0.1:3319';
const fixture = process.env.FIXTURE || 'http://127.0.0.1:54999';
const secret = process.env.ADMIN_SECRET || '';
if (!secret) { console.error('ADMIN_SECRET が要ります（手元だけの値）'); process.exit(2); }

const SITE = 'd41d8cd9-8f00-4b20-a204-9800998ecf84';   // fixture の「以前からある作品」（kyuu-site）
const SLUG = 'kyuu-site';
const A = '公開済みの文章A_PUBLISHED_TEXT';
const B = '未公開の下書き文章B_DRAFT_TEXT';
const session = {
  access_token: 'stub', token_type: 'bearer', expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r',
  user: { id: '7c9e6679-7425-40de-944b-e07fc1f90ae7', email: 'owner@example.com', aud: 'authenticated', role: 'authenticated' },
};
const cookie = `sb-127-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString('base64')}`;
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(ok ? 'OK  ' : 'FAIL', name, detail); };

const asOwner = (path, method, body) => fetch(base + path, {
  method, headers: { cookie, 'content-type': 'application/json', origin: base }, body: body ? JSON.stringify(body) : undefined,
}).then(async (r) => ({ status: r.status, json: await r.json().catch(() => ({})) }));
const asAdmin = (body) => fetch(base + '/api/admin/republish-all', {
  method: 'POST', headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' }, body: JSON.stringify(body),
}).then(async (r) => ({ status: r.status, json: await r.json().catch(() => ({})) }));
const row = async () => (await (await fetch(`${fixture}/rest/v1/sites?id=eq.${SITE}`)).json())[0];
const publicPage = async () => (await fetch(`${base}/hp/${SLUG}`)).text();
const control = (body) => fetch(fixture + '/__control', { method: 'POST', body: JSON.stringify(body) });

const blocks = (heading, extra = {}) => ({ v: 2, pages: [{ id: 'page-main', name: 'トップページ', path: '/', blocks: [
  { id: 'lb-hero', type: 'hero', data: { heading, subheading: '設定を持たない作品', ctaText: 'お問い合わせ', ctaLink: '#contact', ...extra } },
  { id: 'lb-text', type: 'paragraph', data: { text: 'ここは本文です。', align: 'left' } },
  { id: 'lb-contact', type: 'contact', data: { heading: 'お問い合わせ', subheading: 'ご相談はこちらから', fields: ['name', 'email', 'message'], buttonText: '送信する' } },
] }] });
/** 公開HTMLを、前の版（21）で作られた形にする。中身はAのまま、末尾の版の印だけ */
const makeOutdated = async () => {
  const r = await row();
  await control({ patchSite: { id: SITE, patch: { published_html: String(r.published_html).replace(/<!--lhpv:\d+-->$/, '<!--lhpv:21-->') } } });
};

try {
  // 1) 利用者が文章Aで保存して公開する（通常の公開経路。公開時点の版も残る）
  let r = await asOwner(`/api/sites/${SITE}`, 'PUT', { blocks_json: blocks(A) });
  check('利用者：文章Aを保存できる', r.status === 200, String(r.status));
  r = await asOwner(`/api/sites/${SITE}/publish`, 'POST');
  check('利用者：文章Aで公開できる（版も残る）', r.status === 200 && r.json.versionSaved === true, JSON.stringify(r.json).slice(0, 160));
  let s = await row();
  check('公開HTMLは文章A・今の版の印（22）', s.published_html.includes(A) && s.published_html.endsWith('<!--lhpv:22-->'));

  // 2) 公開HTMLを前の版（21）の形にし、利用者は文章Bを下書き保存だけする（公開しない）
  await makeOutdated();
  r = await asOwner(`/api/sites/${SITE}`, 'PUT', { blocks_json: blocks(B) });
  check('利用者：文章Bを下書き保存（未公開）', r.status === 200, String(r.status));
  s = await row();
  check('準備：下書きはB・公開HTMLはA（版21）', JSON.stringify(s.blocks_json).includes(B) && s.published_html.includes(A) && !s.published_html.includes(B) && s.published_html.endsWith('<!--lhpv:21-->'));
  const before = s.published_html;

  // 3) 通常の閲覧（2回）：再生成も書き込みも起きず、Bは出ない
  const v1 = await publicPage(); const v2 = await publicPage();
  s = await row();
  check('閲覧：公開ページは文章A、未公開のBは出ない', v1.includes(A) && !v1.includes(B) && v2.includes(A) && !v2.includes(B));
  check('閲覧：公開HTMLは書き換わらない（版21のまま）', s.published_html === before);

  // 4) 管理者の一括再生成（古い版だけ・まず書かずに対象を確かめる）
  r = await asAdmin({ onlyOutdated: true, slug: SLUG, dryRun: true });
  check('一括再生成（書かない確認）：対象に入る', r.status === 200 && r.json.total === 1, JSON.stringify(r.json).slice(0, 300));
  s = await row();
  check('一括再生成（書かない確認）：公開HTMLは変わらない', s.published_html === before);

  // 5) 管理者の一括再生成（実行）：未公開のBが公開側に出ないこと
  r = await asAdmin({ onlyOutdated: true, slug: SLUG });
  s = await row();
  const page = await publicPage();
  check('一括再生成（実行）：公開HTMLに未公開のBが入らない', !s.published_html.includes(B), `status=${r.status} ${JSON.stringify({ updated: r.json.updated, conflicts: r.json.conflicts, skipped: r.json.skipped, failed: r.json.failed })}`);
  check('一括再生成（実行）：公開ページにも未公開のBが出ない', !page.includes(B) && page.includes(A));
  check('一括再生成（実行）：下書きのBは消えない', JSON.stringify(s.blocks_json).includes(B));

  // 6) 下書き＝公開時点の中身（未公開の変更なし）なら、公開時点の中身で作り直される
  r = await asOwner(`/api/sites/${SITE}`, 'PUT', { blocks_json: blocks(A) });
  await makeOutdated();
  r = await asAdmin({ onlyOutdated: true, slug: SLUG });
  s = await row();
  check('未公開の変更が無いサイト：版22で作り直される', r.json.updated === 1 && s.published_html.endsWith('<!--lhpv:22-->') && s.published_html.includes(A), JSON.stringify({ updated: r.json.updated, skipped: r.json.skipped }));
  // 案を採用していない作品に、新しい見た目・色の役割・動きが付かない
  const h = s.published_html;
  const legacy = { dir: /<body[^>]*data-style-direction/.test(h), motion: /<body[^>]*data-motion/.test(h), separatedCss: h.includes('.lhp-hero.lhp-hero-separated{'), calmCss: h.includes('body[data-motion="calm"]'), roleVars: /style="[^"]*var\(--lhp-d-(bg|ink|accent|surface)\)/.test(h) };
  check('案を採用していない作品：新しい属性・CSS・色の役割・動きが付かない', Object.values(legacy).every((v) => !v), JSON.stringify(legacy));
  // 共通修正（変数の区切り）は作り直したときに入る
  check('共通修正：作り直すと :root の変数の区切りが入る', /:root\{[^}]*;--lhp-accent:/.test(s.published_html));

  // 7) 下書きに「案の採用」だけを入れて公開しない → 一括再生成でも公開側に付かない
  await asOwner(`/api/sites/${SITE}`, 'PUT', { settings_json_patch: { styleDirection: 'immersive', motionProfile: 'calm' } });
  await makeOutdated();
  r = await asAdmin({ onlyOutdated: true, slug: SLUG });
  s = await row();
  check('未公開の「案の採用」：一括再生成でも公開HTMLに付かない', !/<body[^>]*data-style-direction/.test(s.published_html), JSON.stringify({ updated: r.json.updated, skipped: r.json.skipped }));
} finally {
  const failed = results.filter((x) => !x.ok);
  console.log(`\n${results.length - failed.length}/${results.length} OK`);
  if (failed.length) process.exitCode = 1;
}
