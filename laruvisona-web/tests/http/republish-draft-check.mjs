// 公開の境界：「保存」は下書き、「公開」は外部への反映。
// 本文だけでなく、サイト名・SEO題名・説明・OG（og:/twitter:・OGカード）・構造化データも、
// 公開するまでは公開済みの内容（A）のまま出ることを、本番用ビルドの実API経路で確かめる。
//
//   起動: FIXTURE_PORT=54999 node tests/http/fixture.cjs          … 起動したばかりの偽DB
//         ADMIN_SECRET=<手元だけの値> npx next start -p 3319     （fixture 向けにビルドしたもの）
//   実行: ADMIN_SECRET=<同じ値> node tests/http/republish-draft-check.mjs
//
// 利用者の操作（下書き保存・公開）は、通常ユーザーのログインで PUT /api/sites/[id]・
// POST /api/sites/[id]/publish を通す。管理者の直接更新は使わない。
// fixture へ直接書くのは準備だけ（公開HTMLを以前の形にする・版を消す・版の保存を失敗させる）。
// head は比べるときに何も除かない（title・og:・twitter: をそのまま読む）。本文とは別に示す。
const base = process.env.BASE || 'http://127.0.0.1:3319';
const fixture = process.env.FIXTURE || 'http://127.0.0.1:54999';
const secret = process.env.ADMIN_SECRET || '';
if (!secret) { console.error('ADMIN_SECRET が要ります（手元だけの値）'); process.exit(2); }

const SITE = 'd41d8cd9-8f00-4b20-a204-9800998ecf84';   // fixture の「以前からある作品」（kyuu-site）
const SLUG = 'kyuu-site';
const session = {
  access_token: 'stub', token_type: 'bearer', expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r',
  user: { id: '7c9e6679-7425-40de-944b-e07fc1f90ae7', email: 'owner@example.com', aud: 'authenticated', role: 'authenticated' },
};
const cookie = `sb-127-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString('base64')}`;
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(ok ? 'OK  ' : 'FAIL', name, typeof detail === 'string' ? detail : JSON.stringify(detail)); };

const asOwner = (path, method, body) => fetch(base + path, {
  method, headers: { cookie, 'content-type': 'application/json', origin: base }, body: body ? JSON.stringify(body) : undefined,
}).then(async (r) => ({ status: r.status, json: await r.json().catch(() => ({})) }));
const asAdmin = (body) => fetch(base + '/api/admin/republish-all', {
  method: 'POST', headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' }, body: JSON.stringify(body),
}).then(async (r) => ({ status: r.status, json: await r.json().catch(() => ({})) }));
const row = async () => (await (await fetch(`${fixture}/rest/v1/sites?id=eq.${SITE}`)).json())[0];
const control = (body) => fetch(fixture + '/__control', { method: 'POST', body: JSON.stringify(body) });

/* 内容A／B。本文・サイト名・SEO題名・説明・OG題名・OG説明・SEO設定画面のOG画像・事業者情報 */
const content = (k) => ({
  name: `サイト名${k}_NAME`,
  heading: `本文の見出し${k}_BODY`,
  seo: { title: `SEO題名${k}_TITLE`, description: `SEO説明${k}_DESC`, keywords: '', ogTitle: `OG題名${k}_OGT`, ogDescription: `OG説明${k}_OGD` },
  businessInfo: { name: `事業者${k}_BIZ`, phone: k === 'A' ? '03-1111-1111' : '03-2222-2222', ogImage: `https://img.example/og-${k}.png` },
});
const blocks = (heading) => ({ v: 2, pages: [{ id: 'page-main', name: 'トップページ', path: '/', blocks: [
  { id: 'lb-hero', type: 'hero', data: { heading, subheading: '同じ部品ID', ctaText: 'お問い合わせ', ctaLink: '#contact' } },
  { id: 'lb-text', type: 'paragraph', data: { text: 'ここは本文です。', align: 'left' } },
] }] });
const saveDraft = (k) => {
  const c = content(k);
  return asOwner(`/api/sites/${SITE}`, 'PUT', { name: c.name, blocks_json: blocks(c.heading), seo_json: c.seo, settings_json_patch: { businessInfo: c.businessInfo } });
};

/** 公開ページを読む。head（Next が出すもの）と本文（公開HTML）を分けて返す。何も除かない */
/* Next はふつうの閲覧ではメタデータを本文側へ流して後から head へ移すことがある（ストリーミング）。
   OGカードを読む取得器（Twitterbot 等）には head に出すので、head はその UA で読む。
   ふつうの閲覧の応答は、文書全体に下書きの印が無いかを別に確かめる（fullB）。 */
async function view() {
  const html = await (await fetch(`${base}/hp/${SLUG}`, { headers: { 'user-agent': 'Twitterbot/1.0' } })).text();
  const bodyAt = html.search(/<body\b/i);
  const head = bodyAt >= 0 ? html.slice(0, bodyAt) : '';
  const body = bodyAt >= 0 ? html.slice(bodyAt) : html;
  const meta = (attr, key) => (head.match(new RegExp(`<meta[^>]*${attr}="${key}"[^>]*content="([^"]*)"`)) || head.match(new RegExp(`<meta[^>]*content="([^"]*)"[^>]*${attr}="${key}"`)) || [])[1] || '';
  const ld = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).find((t) => t.includes(`/hp/${SLUG}`)) || '';
  return {
    head: {
      title: (head.match(/<title>([^<]*)<\/title>/) || [])[1] || '',
      description: meta('name', 'description'),
      ogTitle: meta('property', 'og:title'), ogDescription: meta('property', 'og:description'), ogImage: meta('property', 'og:image'),
      twitterTitle: meta('name', 'twitter:title'), twitterDescription: meta('name', 'twitter:description'), twitterImage: meta('name', 'twitter:image'),
    },
    body, ld,
  };
}
/** 自動生成のOGカード（/hp/<slug>/opengraph-image）の画像そのもの。中身の比較は SHA-256 で。
    og:image に自分で指定した画像がある間も、カードの経路は公開ページから参照されうるので直接確かめる */
async function card() {
  const r = await fetch(`${base}/hp/${SLUG}/opengraph-image`);
  const buf = Buffer.from(await r.arrayBuffer());
  return (await import('node:crypto')).createHash('sha256').update(buf).digest('hex').slice(0, 16) + ` (${r.status} ${r.headers.get('content-type')}, ${buf.length}B)`;
}
const has = (v, k) => JSON.stringify(v).includes(`${k}_`);
const only = (v, want, other) => has(v, want) && !JSON.stringify(v).match(new RegExp(`(${other})_(NAME|BODY|TITLE|DESC|OGT|OGD|BIZ)`)) && !JSON.stringify(v).includes(`og-${other}.png`);

try {
  // ── A：本文・サイト名・SEO・OG・事業者情報をAとして公開 ──
  let r = await saveDraft('A');
  check('A：保存', r.status === 200, String(r.status));
  r = await asOwner(`/api/sites/${SITE}/publish`, 'POST');
  check('A：公開（版も残る）', r.status === 200 && r.json.versionSaved === true, String(r.status));
  const vA = await view();
  const cardA = await card();
  check('A公開後 head：title・description・og・twitter がA', only(vA.head, 'A', 'B') && vA.head.title === 'SEO題名A_TITLE' && vA.head.ogTitle === 'OG題名A_OGT', vA.head);
  check('A公開後 本文：A', vA.body.includes('本文の見出しA_BODY') && !vA.body.includes('本文の見出しB_BODY'));
  check('A公開後 構造化データ：事業者A', vA.ld.includes('事業者A_BIZ') && vA.ld.includes('SEO説明A_DESC'), vA.ld.slice(0, 200));

  // ── B：それらをBに変えて下書き保存（公開しない）──
  r = await saveDraft('B');
  check('B：下書き保存', r.status === 200, String(r.status));
  const s0 = await row();
  check('準備：下書きはB・公開HTMLはA', s0.name === 'サイト名B_NAME' && JSON.stringify(s0.blocks_json).includes('B_BODY') && s0.published_html.includes('A_BODY') && !s0.published_html.includes('B_BODY'));

  // ── C：閲覧と dryRun では、本文・head ともAのまま ──
  const vB1 = await view(), vB2 = await view();
  const plain = await (await fetch(`${base}/hp/${SLUG}`)).text();
  check('C 閲覧（ふつうのUA・文書全体）：下書きBの文字・名前・SEO・OG・事業者情報が1つも出ない', !/B_(NAME|BODY|TITLE|DESC|OGT|OGD|BIZ)|og-B\.png/.test(plain) && plain.includes('A_TITLE'));
  check('C 閲覧 本文：Aのまま（Bは出ない）', [vB1, vB2].every((v) => v.body.includes('本文の見出しA_BODY') && !v.body.includes('本文の見出しB_BODY')));
  check('C 閲覧 head：title・description・og・twitter がAのまま（何も除かずに比較）', [vB1, vB2].every((v) => JSON.stringify(v.head) === JSON.stringify(vA.head)), vB1.head);
  check('C 閲覧 構造化データ：Aのまま', vB1.ld === vA.ld, vB1.ld.slice(0, 200));
  const cardB1 = await card();
  check('C 閲覧 OGカード画像：A公開時と同じ画像', cardB1 === cardA, `${cardA} / ${cardB1}`);
  r = await asAdmin({ slug: SLUG, dryRun: true });
  check('C dryRun：未公開の変更として扱い、書かない予定', r.json.targets?.[0]?.plan === 'unpublished_changes', JSON.stringify(r.json.targets?.[0] ?? r.json).slice(0, 200));
  check('C dryRun 後も公開HTMLは同じ', (await row()).published_html === s0.published_html);

  // ── D：一括再生成は未公開の変更を書かない。下書きBも消えない ──
  r = await asAdmin({ slug: SLUG });
  const s1 = await row();
  check('D 一括再生成：書かない（skipped）', r.json.updated === 0 && r.json.skipped?.[0]?.status === 'skipped_unpublished_changes', JSON.stringify({ updated: r.json.updated, skipped: r.json.skipped }));
  check('D 公開HTML・公開ページはA、下書きBは残る', s1.published_html === s0.published_html && JSON.stringify(s1.blocks_json).includes('B_BODY') && s1.name === 'サイト名B_NAME' && (await view()).head.title === 'SEO題名A_TITLE');

  // ── F1：公開に失敗したら、本文・head ともAのまま（下書きへ切り替えない）──
  await control({ failWrites: true });
  r = await asOwner(`/api/sites/${SITE}/publish`, 'POST');
  await control({ failWrites: false });
  const vF1 = await view();
  check('F 公開の失敗：本文・head ともAのまま', r.status >= 500 && vF1.body.includes('本文の見出しA_BODY') && JSON.stringify(vF1.head) === JSON.stringify(vA.head), `publish ${r.status}`);

  // ── E：本人が公開すると、本文・head・構造化データ・カードが対応してBへ ──
  r = await asOwner(`/api/sites/${SITE}/publish`, 'POST');
  const vE = await view();
  const cardE = await card();
  check('E 公開後 本文：B', r.status === 200 && vE.body.includes('本文の見出しB_BODY') && !vE.body.includes('本文の見出しA_BODY'));
  check('E 公開後 head：title・description・og・twitter がB（Aは残らない）', only(vE.head, 'B', 'A') && vE.head.title === 'SEO題名B_TITLE' && vE.head.ogTitle === 'OG題名B_OGT', vE.head);
  check('E 公開後 構造化データ：B', vE.ld.includes('事業者B_BIZ') && !vE.ld.includes('事業者A_BIZ'), vE.ld.slice(0, 200));
  check('E 公開後 OGカード画像：変わる', cardE !== cardA, `${cardA} → ${cardE}`);

  // ── F2：以前の公開HTML（補足なし）で、版が無い ──
  await saveDraft('A'); await asOwner(`/api/sites/${SITE}/publish`, 'POST');   // 公開＝A
  let s2 = await row();
  await control({ patchSite: { id: SITE, patch: { published_html: s2.published_html.replace(/<!--lhpmeta:[^>]*-->/, '').replace(/<!--lhpv:\d+-->$/, '<!--lhpv:21-->') } } });
  await control({ clearVersions: SITE });
  await saveDraft('B');
  const vF2 = await view();
  check('F 以前のHTML・版なし 本文：A', vF2.body.includes('本文の見出しA_BODY') && !vF2.body.includes('本文の見出しB_BODY'));
  check('F 以前のHTML・版なし head：公開HTMLの値（A）だけ', only(vF2.head, 'A', 'B'), vF2.head);
  check('F 以前のHTML・版なし 構造化データ：下書きBで補わない（事業者情報は付けない）', !vF2.ld.includes('_BIZ') && !vF2.ld.includes('B_NAME') && vF2.ld.includes('SEO題名A_TITLE'), vF2.ld.slice(0, 200));
  r = await asAdmin({ slug: SLUG, dryRun: true });
  check('F 以前のHTML・版なし dryRun：書かない予定', ['no_snapshot', 'unpublished_changes'].includes(r.json.targets?.[0]?.plan), JSON.stringify(r.json.targets?.[0]).slice(0, 200));

  // ── F3：部品IDは同じで文字だけ違う（版の保存に失敗した公開のあと、下書きを元に戻した）──
  await saveDraft('A'); await asOwner(`/api/sites/${SITE}/publish`, 'POST');          // 公開＝A、版＝A
  await saveDraft('B'); await control({ failVersionInsert: true });
  r = await asOwner(`/api/sites/${SITE}/publish`, 'POST');                              // 公開＝B、版の保存は失敗（版＝Aのまま）
  check('準備：Bを公開・版の保存は失敗', r.status === 200 && r.json.versionSaved === false, JSON.stringify(r.json).slice(0, 120));
  await saveDraft('A');                                                                 // 下書き＝A＝最新の版（部品IDも同じ）
  s2 = await row();
  await control({ patchSite: { id: SITE, patch: { published_html: s2.published_html.replace(/<!--lhpmeta:[^>]*-->/, '').replace(/<!--lhpv:\d+-->$/, '<!--lhpv:21-->') } } });
  const vF3 = await view();
  check('F 版と公開HTMLの不一致 本文：公開中のB', vF3.body.includes('本文の見出しB_BODY'));
  check('F 版と公開HTMLの不一致 head：公開HTMLの値（B）。版・下書き（A）で上書きしない', only(vF3.head, 'B', 'A'), vF3.head);
  check('F 版と公開HTMLの不一致 構造化データ：確かめられないので事業者情報を付けない', !vF3.ld.includes('_BIZ'), vF3.ld.slice(0, 200));
  r = await asAdmin({ slug: SLUG, dryRun: true });
  const t = r.json.targets?.[0] ?? {};
  check('F 版と公開HTMLの不一致 dryRun：snapshot_mismatch（理由つき）で書かない予定', t.plan === 'snapshot_mismatch' && /head_mismatch|content_mismatch/.test(t.detail || ''), JSON.stringify(t).slice(0, 200));
  r = await asAdmin({ slug: SLUG });
  check('F 版と公開HTMLの不一致 実行：Aへ巻き戻さない', r.json.updated === 0 && (await row()).published_html.includes('本文の見出しB_BODY'), JSON.stringify({ updated: r.json.updated, skipped: r.json.skipped }));

  // ── F4：部品IDも head も同じで、本文の文字だけ違う（版の保存に失敗した公開のあと）──
  const stripMeta = async () => { const x = await row(); await control({ patchSite: { id: SITE, patch: { published_html: x.published_html.replace(/<!--lhpmeta:[^>]*-->/, '').replace(/<!--lhpv:\d+-->$/, '<!--lhpv:21-->') } } }); };
  await saveDraft('A'); await asOwner(`/api/sites/${SITE}/publish`, 'POST');          // 公開＝A、版＝A
  await asOwner(`/api/sites/${SITE}`, 'PUT', { blocks_json: blocks('本文の見出しだけ違うA2_BODY') });
  await control({ failVersionInsert: true });
  r = await asOwner(`/api/sites/${SITE}/publish`, 'POST');                              // 公開＝A2（本文だけ違う）、版＝Aのまま
  await saveDraft('A'); await stripMeta();                                              // 下書き＝A＝版、部品ID・SEOも同じ
  r = await asAdmin({ slug: SLUG, dryRun: true });
  const t4 = r.json.targets?.[0] ?? {};
  check('F 本文の文字だけ違う dryRun：content_mismatch で書かない予定（部品IDだけで同じと判定しない）', t4.plan === 'snapshot_mismatch' && t4.detail === 'content_mismatch', JSON.stringify(t4).slice(0, 200));
  const vF4 = await view();
  check('F 本文の文字だけ違う 構造化データ：確かめられないので事業者情報を付けない', !vF4.ld.includes('_BIZ') && vF4.body.includes('A2_BODY'), vF4.ld.slice(0, 160));

  // ── F5：以前の公開HTMLで、版が公開HTMLの元だと確かめられる（未公開の変更なし）──
  await saveDraft('A'); await asOwner(`/api/sites/${SITE}/publish`, 'POST'); await stripMeta();
  const vF5 = await view();
  check('F 以前のHTML・版が一致 head：A', only(vF5.head, 'A', 'B'), vF5.head);
  check('F 以前のHTML・版が一致 構造化データ：公開時点の事業者情報（A）を付ける', vF5.ld.includes('事業者A_BIZ'), vF5.ld.slice(0, 200));
  r = await asAdmin({ slug: SLUG, dryRun: true });
  check('F 以前のHTML・版が一致 dryRun：作り直せる（regenerate）', r.json.targets?.[0]?.plan === 'regenerate', JSON.stringify(r.json.targets?.[0]).slice(0, 160));

  // ── 案を採用していない作品に、新しい見た目の属性が付かない（公開し直しても）──
  await saveDraft('A'); await asOwner(`/api/sites/${SITE}/publish`, 'POST');
  const h = (await row()).published_html;
  const legacy = { dir: /<body[^>]*data-style-direction/.test(h), motion: /<body[^>]*data-motion/.test(h), separatedCss: h.includes('.lhp-hero.lhp-hero-separated{'), calmCss: h.includes('body[data-motion="calm"]') };
  check('案を採用していない作品：新しい属性・CSS・動きが付かない', Object.values(legacy).every((v) => !v), JSON.stringify(legacy));
} finally {
  const failed = results.filter((x) => !x.ok);
  console.log(`\n${results.length - failed.length}/${results.length} OK`);
  if (failed.length) process.exitCode = 1;
}
