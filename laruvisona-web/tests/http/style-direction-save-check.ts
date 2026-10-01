/* eslint-disable @typescript-eslint/no-explicit-any -- 確認用スクリプト：APIの応答（JSON）の形をそのまま辿るため */
// 見た目の案を採用したサイトを、通常ユーザーの保存API（PUT /api/sites/[id]）で保存し、
// 読み直し（GET /api/sites/[id]）→ 描画（exportToHTML）→ 公開（POST /api/sites/[id]/publish）まで、
// 新しい設定が落ちたり既定値へ戻ったりしないことを確かめる。
//
//   起動: FIXTURE_PORT=54999 node tests/http/fixture.cjs ／ fixture 向けビルドを next start -p 3319
//   実行: node --import ./tests/_resolve-ts.mjs tests/http/style-direction-save-check.ts
//
// 認証は fixture の通常ユーザー（owner）。所有者の確認（user_id）はAPI側の条件をそのまま通る。
// 管理者の直接更新は使わない。
import { createHash } from 'node:crypto';
import { planStyleDirection } from '../../lib/style-direction-plan';
import { exportToHTML } from '../../lib/html-export';
import { canonicalJson } from '../../lib/republish-source';
import type { Block, Page, SiteSettings } from '../../types/laruHP';

const base = process.env.BASE || 'http://127.0.0.1:3319';
const SITE = 'd41d8cd9-8f00-4b20-a204-9800998ecf84';
const session = {
  access_token: 'stub', token_type: 'bearer', expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r',
  user: { id: '7c9e6679-7425-40de-944b-e07fc1f90ae7', email: 'owner@example.com', aud: 'authenticated', role: 'authenticated' },
};
const cookie = `sb-127-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString('base64')}`;
const api = async (path: string, method = 'GET', body?: unknown) => {
  const r = await fetch(base + path, { method, headers: { cookie, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, json: await r.json().catch(() => ({})) as Record<string, any> };
};
const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);
const results: { name: string; ok: boolean; detail: string }[] = [];
const check = (name: string, ok: unknown, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(ok ? 'OK  ' : 'FAIL', name, detail); };

const top: Block[] = [
  { id: 'sv-hero', type: 'hero', data: { heading: '足立ホーム工房', subheading: '地域の住まいづくり', ctaText: '相談する', ctaLink: '#contact', bgImage: '/studio/placeholders/construction.webp', bgImageAlt: 'サンプル写真。施工した建物' } },
  { id: 'sv-text', type: 'paragraph', data: { text: '暮らしの話を伺うところから。', align: 'center' } },
  { id: 'sv-gallery', type: 'gallery', data: { heading: '施工写真', images: ['/studio/placeholders/construction.webp', '/studio/placeholders/construction.webp'] } },
  { id: 'sv-contact', type: 'contact', data: { heading: 'お問い合わせ', subheading: 'ご相談はこちら', fields: ['name', 'email', 'message'], buttonText: '送信する', buttonColor: '#1e3a8a', phone: '03-1234-5678' } },
] as Block[];
const page2: Page = { id: 'page-2', name: '会社案内', path: '/company', seo: { title: '会社案内', description: '会社の紹介', keywords: '' } as Page['seo'],
  blocks: [{ id: 'p2-text', type: 'paragraph', data: { text: '2ページ目の本文（変えない）', align: 'center', textColor: '#333333' } },
    { id: 'p2-cta', type: 'cta', data: { heading: '2ページ目の帯', buttonText: '電話', buttonLink: 'tel:0312345678', bgColor: '#f7f4ef' } }] as Block[] };
const seo = { title: '足立ホーム工房', description: '住まいづくり', keywords: '', ogTitle: '', ogDescription: '' };
const settings = { colorScheme: 'professional-blue', designStyle: 'modern', fontFamily: 'noto', accentColor: '#c2410c', heroLayout: 'center', headerStyle: 'solid', animLevel: 'subtle', customCss: '.lhp-hero h1{letter-spacing:.08em}', gaTrackingId: 'G-LOCALTEST' };

try {
  // 0) 準備：採用前の状態を通常の保存APIで置く（2ページ・対象外の設定あり）
  let r = await api(`/api/sites/${SITE}`, 'PUT', { blocks_json: { v: 2, pages: [{ id: 'page-main', name: 'トップページ', path: '/', blocks: top, seo }, page2] }, seo_json: seo, settings_json: settings });
  check('準備：採用前の作品を保存', r.status === 200, String(r.status));
  const original = (await api(`/api/sites/${SITE}`)).json.site;

  // 1) 案（写真で惹きつける・案の配色・個別色もテーマへ）を採用 → 制作画面と同じく「変わった設定だけ」を重ねて保存
  const site = { pages: original.blocks_json.pages as Page[], settings: original.settings_json as SiteSettings };
  const plan = planStyleDirection(site as never, 'immersive', { usePalette: true, themeColors: true });
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(plan.settings)) if (canonicalJson(v) !== canonicalJson((site.settings as unknown as Record<string, unknown>)[k])) patch[k] = v;
  r = await api(`/api/sites/${SITE}`, 'PUT', { blocks_json: { v: 2, pages: plan.pages }, settings_json_patch: patch });
  check('保存：通常ユーザーの保存APIが受け付ける', r.status === 200, `${r.status} 送った設定: ${Object.keys(patch).join(',')}`);

  // 2) 読み直し
  const saved = (await api(`/api/sites/${SITE}`)).json.site;
  const st = saved.settings_json as Record<string, any>;
  check('読み直し：選んだ案・動き', st.styleDirection === 'immersive' && st.motionProfile === 'calm', JSON.stringify({ styleDirection: st.styleDirection, motionProfile: st.motionProfile }));
  check('読み直し：配色（design 一式）が送ったとおり', canonicalJson(st.design) === canonicalJson((plan.settings as any).design), JSON.stringify(st.design).slice(0, 160));
  check('読み直し：対象外の設定が残る（customCss・計測ID・配色名・見出しの寄せ方 等）',
    st.customCss === settings.customCss && st.gaTrackingId === settings.gaTrackingId && st.colorScheme === settings.colorScheme && st.headerStyle === settings.headerStyle && st.animLevel === settings.animLevel);
  const contact = saved.blocks_json.pages[0].blocks.find((b: Block) => b.id === 'sv-contact');
  check('読み直し：色の役割と、個別色の元の値が残る', contact.data.colorRoles?.buttonColor === 'accent' && contact.data.buttonColor === '#1e3a8a', JSON.stringify({ colorRoles: contact.data.colorRoles, buttonColor: contact.data.buttonColor }));
  const hero = saved.blocks_json.pages[0].blocks.find((b: Block) => b.id === 'sv-hero');
  check('読み直し：写真・alt・見本の印・電話が残る', hero.data.bgImage === top[0].data.bgImage && hero.data.bgImageAlt === top[0].data.bgImageAlt && contact.data.phone === '03-1234-5678');
  check('読み直し：2ページ目のデータ（本文・色・リンク・節）が完全に同じ', canonicalJson(saved.blocks_json.pages[1]) === canonicalJson(page2));
  check('読み直し：トップのデータは採用した計画と完全に同じ', canonicalJson(saved.blocks_json.pages[0]) === canonicalJson(plan.pages[0]));

  // 3) 読み直した内容の描画 ＝ 採用直後の描画（同じ関数・同じ引数）
  const info = { name: saved.name, siteId: SITE, slug: saved.slug };
  const fromPlan = exportToHTML(plan.pages, seo as never, { ...settings, ...patch } as SiteSettings, saved.name, info);
  const fromSaved = exportToHTML(saved.blocks_json.pages, saved.seo_json, saved.settings_json, saved.name, info);
  check('描画：読み直した内容の公開HTML＝採用直後（内容一致）', fromSaved === fromPlan, `sha256 ${sha(fromSaved)} / ${sha(fromPlan)}`);
  check('描画：案・動き・役割が公開HTMLに出る', /<body[^>]*data-style-direction="immersive"[^>]*data-motion="calm"/.test(fromSaved) && fromSaved.includes('var(--lhp-d-accent)'));

  // 4) 公開（通常ユーザーの公開API）→ 保存された公開HTML＝読み直した内容の描画
  r = await api(`/api/sites/${SITE}/publish`, 'POST');
  const fx = await (await fetch(`http://127.0.0.1:54999/rest/v1/sites?id=eq.${SITE}`)).json();
  const pub = String(fx[0].published_html);
  const expectPub = exportToHTML(saved.blocks_json.pages, saved.seo_json, saved.settings_json, saved.name, { name: saved.name, industry: saved.industry ?? undefined, siteId: SITE, slug: saved.slug });
  check('公開：保存された公開HTML＝読み直した内容の描画（内容一致）', r.status === 200 && pub === expectPub, `sha256 ${sha(pub)} / ${sha(expectPub)}`);
  const pubPage = await (await fetch(`${base}/hp/${saved.slug}`)).text();
  check('公開ページ：2ページ目の本文も出る', pubPage.includes('2ページ目の本文（変えない）'));

  // 5) 取り消し相当：採用前の中身へ戻して保存（制作画面は空文字で上書きする）→ 新しい設定は効かない
  const undoPatch: Record<string, unknown> = {};
  for (const k of Object.keys(patch)) undoPatch[k] = (original.settings_json as Record<string, unknown>)[k] ?? (k === 'styleDirection' || k === 'motionProfile' || k === 'designPreset' ? '' : null);
  r = await api(`/api/sites/${SITE}`, 'PUT', { blocks_json: original.blocks_json, settings_json_patch: undoPatch });
  const back = (await api(`/api/sites/${SITE}`)).json.site;
  const backHtml = exportToHTML(back.blocks_json.pages, back.seo_json, back.settings_json, back.name, info);
  const origHtml = exportToHTML(original.blocks_json.pages, original.seo_json, original.settings_json, original.name, info);
  check('取り消して保存：描画が採用前と完全一致', r.status === 200 && backHtml === origHtml, `sha256 ${sha(backHtml)} / ${sha(origHtml)}`);
} finally {
  const failed = results.filter((x) => !x.ok);
  console.log(`\n${results.length - failed.length}/${results.length} OK`);
  if (failed.length) process.exitCode = 1;
}
