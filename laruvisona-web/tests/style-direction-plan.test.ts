import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeStarterSite } from '../lib/studio-start';
import { planStyleDirection } from '../lib/style-direction-plan';
import { exportToHTML } from '../lib/html-export';
import { editStudioBlock } from '../lib/studio-image';
import { applyAiEditActions } from '../lib/ai-edit-actions';
import type { Block, Page } from '../types/laruHP';

const intake = { industry: 'construction', name: '足立ホーム工房', area: '東京都足立区', audience: '足立区で住まいを考えている方',
  description: '暮らしの話を伺うところから、住まいづくりを始めます。', goal: 'contact', phone: '03-1234-5678' } as never;
const PH = '/studio/placeholders/construction.webp';
function site() {
  const s = makeStarterSite(intake, 'calm');
  s.pages[0].blocks = s.pages[0].blocks.map(b => b.type === 'gallery' ? { ...b, data: { ...b.data, images: [PH, PH, PH] } } : b);
  const second: Page = { id: 'page-2', name: '会社案内', path: '/about', seo: s.pages[0].seo!, blocks: [{ id: 'p2', type: 'paragraph', data: { text: '2ページ目の本文', align: 'center' } }] };
  return { ...s, pages: [...s.pages, second], settings: { ...s.settings, notifyEmail: 'owner@example.com', customCss: '.x{color:red}', gaTrackingId: 'G-TEST', larubot: true } };
}
const STYLE_KEYS = new Set(['align', 'compositionStyle', 'heroLayout', 'textColor', 'adaptiveLayout', 'galleryLayout', 'columns', 'mobilePhotoFit', 'colorRoles']);
const content = (pages: Page[]) => JSON.stringify(pages.map(p => ({ id: p.id, seo: p.seo, blocks: [...p.blocks].sort((a, b) => a.id.localeCompare(b.id)).map(b => ({ id: b.id, type: b.type, data: Object.fromEntries(Object.entries(b.data).filter(([k]) => !STYLE_KEYS.has(k)).sort()) })) })));
const IDS = ['editorial', 'immersive', 'catalog'] as const;
const render = (s: ReturnType<typeof site>) => exportToHTML(s.pages, s.pages[0].seo!, s.settings as never, s.name);

test('3案とも、本文・写真・リンク・電話・フォーム・ID・他のページを変えない', () => {
  const base = site();
  for (const id of IDS) for (const usePalette of [false, true]) for (const themeColors of [false, true]) {
    const plan = planStyleDirection(base, id, { usePalette, themeColors });
    assert.equal(content(plan.pages), content(base.pages), `${id} ${usePalette} ${themeColors}`);
    assert.deepEqual(plan.pages[1], base.pages[1], '他のページはそのまま');
    const html = render({ ...base, pages: plan.pages, settings: plan.settings });
    assert.ok(html.includes('href="tel:0312345678"') && html.includes('href="#contact"') && /name="email"/.test(html), id);
  }
});

test('候補は同じ元の状態から作り、選び替えても積み重ならない。元のデータは書き換えない', () => {
  const base = site();
  const snapshot = structuredClone(base);
  const direct = planStyleDirection(base, 'catalog');
  planStyleDirection(base, 'editorial');
  planStyleDirection(base, 'immersive');
  assert.deepEqual(planStyleDirection(base, 'catalog'), direct);
  assert.deepEqual(base, snapshot, 'プレビューだけでは元のサイトを変えない（取り消しで戻る先がそのまま）');
});

test('同じ案を2回採用しても、節・設定・役割が重複しない', () => {
  for (const id of IDS) {
    const once = planStyleDirection(site(), id, { usePalette: true, themeColors: true });
    const twice = planStyleDirection({ ...site(), pages: once.pages, settings: once.settings }, id, { usePalette: true, themeColors: true });
    assert.deepEqual(twice.pages, once.pages, id);
    assert.deepEqual(twice.settings, once.settings, id);
    const html = render({ ...site(), pages: twice.pages, settings: twice.settings });
    assert.equal((html.match(/<body[^>]*data-style-direction=/g) || []).length, 1);
    assert.equal(html.split('.lhp-hero.lhp-hero-separated{').length - 1, 1, 'CSSが重複しない');
  }
});

test('変えるのは案の項目だけ。連携・計測・独自CSS・案で触らない余白の調整は残す', () => {
  const base = site();
  base.settings.design = { ...base.settings.design, bodyScale: 1.12, photoRatio: '3:4' } as never;
  const plan = planStyleDirection(base, 'editorial');
  for (const k of ['notifyEmail', 'customCss', 'gaTrackingId', 'larubot', 'laruseo', 'heroLayout', 'headerStyle', 'animLevel'] as const)
    assert.deepEqual(plan.settings[k], base.settings[k], k);
  const d = plan.settings.design as Record<string, unknown>;
  assert.equal(d.bodyScale, 1.12);
  assert.equal(d.photoRatio, '3:4');
  for (const k of ['ink', 'bg', 'accent', 'surface', 'line', 'onAccent']) assert.equal(d[k], (base.settings.design as Record<string, unknown>)[k], `配色は今のまま：${k}`);
  assert.equal(plan.settings.fontFamily, 'biz');
  assert.ok(plan.changes.some(c => c.label === '書体'));
  assert.ok(plan.changes.some(c => c.label === '配色' && /今の配色のまま/.test(c.detail)));
  const withPalette = planStyleDirection(base, 'editorial', { usePalette: true, themeColors: false });
  assert.equal((withPalette.settings.design as Record<string, unknown>).accent, '#295bb5');
});

test('個別に入っている色は、利用者が選んだときだけテーマに合わせる（値は消さない）', () => {
  const base = site();
  const plain = planStyleDirection(base, 'editorial');
  const contact = plain.pages[0].blocks.find(b => b.type === 'contact')!;
  assert.equal(contact.data.buttonColor, '#1e3a8a');
  assert.equal((contact.data.colorRoles as Record<string, string> | undefined)?.buttonColor, undefined);
  assert.ok(plain.individualColors.some(c => c.key === 'buttonColor' && c.value === '#1e3a8a'));
  const themed = planStyleDirection(base, 'editorial', { usePalette: false, themeColors: true });
  const c2 = themed.pages[0].blocks.find(b => b.type === 'contact')!;
  assert.equal(c2.data.buttonColor, '#1e3a8a', '値は残す');
  assert.deepEqual(c2.data.colorRoles, { buttonColor: 'accent', bgColor: 'surface' });
});

test('テーマに従う部品は、あとで配色を変えても追従する。色を選び直すと個別の色になる', () => {
  const base = site();
  const p = planStyleDirection(base, 'editorial', { usePalette: false, themeColors: true });
  let s = { ...base, pages: p.pages, settings: p.settings };
  const html1 = render(s);
  assert.match(html1, /id="contact"[^>]*background-color:var\(--lhp-d-surface\)/);
  assert.match(html1, /background-color:var\(--lhp-d-accent\)[^"]*"[^>]*>送信する|style="background-color:var\(--lhp-d-accent\)"/);
  // 配色を変える（Studioの「色の組み合わせ」と同じく design の色だけ変える）
  s = { ...s, settings: { ...s.settings, design: { ...(s.settings.design as object), accent: '#a54938' } as never } };
  const html2 = render(s);
  assert.match(html2, /--lhp-d-accent:#a54938/);
  assert.match(html2, /var\(--lhp-d-accent\)/, '数値をコピーしていないので追従する');
  // 利用者がボタンの色を選ぶ → その欄だけ役割を外す
  const contact = s.pages[0].blocks.find(b => b.type === 'contact')!;
  const edited = editStudioBlock(contact, 'buttonColor', '#00aa55');
  assert.equal(edited.data.buttonColor, '#00aa55');
  assert.deepEqual(edited.data.colorRoles, { bgColor: 'surface' });
  // 旧編集画面のAIチャットで色が変わった場合も同じ
  const ai = applyAiEditActions([contact], [{ type: 'update_block', blockId: contact.id, data: { bgColor: '#ffffff' } }])[0];
  assert.deepEqual(ai.data.colorRoles, { buttonColor: 'accent' });
});

test('写真で惹きつける：写真が見本のまま・写真なしは文字と写真を上下に分け、差し替え後は写真に重ねる', () => {
  const base = site();
  const p = planStyleDirection(base, 'immersive');
  const s = { ...base, pages: p.pages, settings: p.settings };
  const sample = render(s);
  const heroTag = sample.match(/<section[^>]*class="lhp-hero[^"]*"[^>]*>/)![0];
  assert.match(heroTag, /lhp-hero-separated/);
  assert.doesNotMatch(heroTag, /background-image/, '見本画像の上に見出しを重ねない');
  assert.match(sample, /class="lhp-hero-stage"><img class="lhp-hero-img" src="\/studio\/placeholders\/construction\.webp" alt="サンプル写真。/);
  const hero = s.pages[0].blocks.find(b => b.type === 'hero')!;
  assert.equal(hero.data.bgImage, PH, 'URLは変えない');
  assert.match(String(hero.data.bgImageAlt), /^サンプル写真。/, '見本の印は残す');
  // 本人の写真に差し替え（見本の印が外れる）→ 写真に文字を重ねる組み方に戻る。保存済みの組み方は変えていない
  const replaced = editStudioBlock(hero, 'bgImage', 'https://cdn.example.com/u/house.webp');
  const real = render({ ...s, pages: [{ ...s.pages[0], blocks: s.pages[0].blocks.map(b => b.id === hero.id ? replaced : b) }, ...s.pages.slice(1)] });
  const realTag = real.match(/<section[^>]*class="lhp-hero[^"]*"[^>]*>/)![0];
  assert.doesNotMatch(realTag, /lhp-hero-separated/);
  assert.match(realTag, /background-image:url\(https:\/\/cdn\.example\.com\/u\/house\.webp\)/);
  assert.equal(replaced.data.heroLayout, hero.data.heroLayout);
  // 写真なし
  const none = render({ ...s, pages: [{ ...s.pages[0], blocks: s.pages[0].blocks.map(b => b.id === hero.id ? { ...b, data: { ...b.data, bgImage: '' } } : b) }, ...s.pages.slice(1)] });
  assert.match(none.match(/<section[^>]*class="lhp-hero[^"]*"[^>]*>/)![0], /lhp-hero-separated/);
  assert.doesNotMatch(none, /class="lhp-hero-stage"/);
});

test('案を採用していない作品は、新しいCSS・属性・安全表示を出さない', () => {
  const s = site();
  const blocks = s.pages[0].blocks.map((b: Block) => b.type === 'hero' ? { ...b, data: { ...b.data, compositionStyle: 'immersive', heroLayout: 'center' } } : b);
  const html = render({ ...s, pages: [{ ...s.pages[0], blocks }, ...s.pages.slice(1)] });
  assert.doesNotMatch(html, /data-style-direction|data-motion="calm"|lhp-hero-separated|lhp-hero-stage/);
  assert.match(html, /var calm=false/);
});

test('控えめな動き：打ち込み・カウントアップを止め、表示の動きを0.32秒に抑える（elegant の1秒を上書き）', () => {
  const p = planStyleDirection(site(), 'immersive');
  const html = render({ ...site(), pages: p.pages, settings: p.settings });
  assert.match(html, /var calm=true/);
  assert.match(html, /if\(!reduce&&!calm&&\(style==='bold'\|\|style==='sharp'\)\)/);
  assert.match(html, /var cio=!reduce&&!calm&&new IntersectionObserver/);
  const elegant = html.indexOf('transition-duration:1s!important');
  const calm = html.indexOf('body[data-motion="calm"] [data-lhp-anim]{transition-duration:.32s!important');
  assert.ok(elegant > 0 && calm > elegant, '後に出して上書きする');
});

test('見た目の型のCSS変数の区切りが欠けていない（--lhp-cta-pd と --lhp-accent）', () => {
  for (const designStyle of ['modern', 'minimal', 'bold', 'elegant', 'rounded', 'sharp']) {
    const s = site();
    const html = render({ ...s, settings: { ...s.settings, designStyle } });
    assert.match(html, /--lhp-cta-pd:[^;]+;--lhp-accent:/, designStyle);
  }
});

test('保存の往復：制作画面は案の設定を保存し、読み込みで戻す。未採用は空で送って上書きする', () => {
  const src = readFileSync('app/laruHP/studio/page.tsx', 'utf8');
  assert.match(src, /styleDirection: s\.styleDirection \|\| ''/);
  assert.match(src, /motionProfile: s\.motionProfile \|\| ''/);
  assert.match(src, /styleDirection: \(st\.styleDirection as string\) \|\| ''/);
  assert.match(src, /motionProfile: \(st\.motionProfile as string\) \|\| ''/);
  assert.match(src, /planStyleDirection\(prev,id,opts\)/, '採用はプレビューと同じ計画関数で、1回の setSite（履歴1件）');
});
