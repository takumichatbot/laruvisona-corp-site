// 「公開の準備」の指摘 → 直す欄（節・項目・繰り返しの位置）の対応。
// 判定は増やさない（publish-readiness と同じ材料）。古い指摘で別の欄を開かない。
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeStarterSite, STARTER_EXAMPLES } from '../lib/studio-start';
import { INDUSTRY_TEMPLATES } from '../lib/templates';
import { checkPublishReadiness } from '../lib/publish-readiness';
import { readinessTargets, resolveTarget, targetPath, type FixTarget } from '../lib/readiness-targets';
import { guideFor } from '../lib/field-guides';
import { isPlaceholderText, hasPlaceholderText } from '../lib/placeholder-text';
import { BLOCK_DEFS } from '../lib/studio-schema';
import type { Block, Page } from '../types/laruHP';

const base = { name: '足立ホーム', area: '東京都足立区', audience: '', description: '' };
const make = (industry: string) =>
  makeStarterSite({ ...base, industry, goal: STARTER_EXAMPLES[industry]?.goal ?? 'contact' } as never, 'strong');

/** 指摘の位置にある、いまの値 */
function valueAt(pages: Page[], t: FixTarget): unknown {
  const b = pages.find(p => p.id === t.pageId)?.blocks.find(x => x.id === t.blockId);
  const v = (b?.data as Record<string, unknown>)?.[t.field];
  if (t.index === undefined) return v;
  const item = (v as unknown[])[t.index];
  return t.sub ? (item as Record<string, unknown>)[t.sub] : item;
}

test('全業種の下書き：例文の指摘は、判定が「残っている」と言う限り1か所以上あり、どれも実際にその値の欄を指す', () => {
  for (const industry of Object.keys(INDUSTRY_TEMPLATES)) {
    const site = make(industry);
    const items = checkPublishReadiness({ name: site.name ?? base.name, pages: site.pages } as never);
    const ph = items.find(i => i.id === 'placeholder')!;
    if (!ph.ok) assert.ok((ph.targets?.length ?? 0) > 0, `${industry}: 例文が残っているのに直す場所が無い`);
    for (const t of readinessTargets(site.pages)) {
      assert.equal(valueAt(site.pages, t), t.expect, `${industry}: ${t.id}`);
      if (t.kind === 'placeholder') assert.ok(isPlaceholderText(t.expect), `${industry}: ${t.id} は例文ではない`);
      if (t.editable) {
        const def = BLOCK_DEFS[site.pages[t.pageIndex].blocks.find(b => b.id === t.blockId)!.type];
        const f = def.fields.find(x => x.key === t.field);
        assert.ok(f, `${industry}: ${t.id} の編集欄が無い`);
        if (t.sub) assert.ok(f!.item?.some(s => s.key === t.sub), `${industry}: ${t.id} の繰り返し項目の欄が無い`);
      }
      assert.ok(t.section && t.fieldLabel && t.problem && t.action);
      assert.ok(!isPlaceholderText(t.section), `${industry}: 節の名前に例文を使わない（${t.section}）`);
    }
  }
});

test('例文をすべて直すと、指摘は0になり、判定とも一致する（新しい必須条件を足さない）', () => {
  const site = make('construction');
  const pages: Page[] = JSON.parse(JSON.stringify(site.pages));
  for (const t of readinessTargets(pages).filter(t => t.kind === 'placeholder')) {
    const b = pages[t.pageIndex].blocks.find(x => x.id === t.blockId)!;
    const d = b.data as Record<string, unknown>;
    if (t.index === undefined) d[t.field] = '本人が書いた文';
    else if (t.sub) (d[t.field] as Record<string, unknown>[])[t.index][t.sub] = '本人が書いた文';
    else (d[t.field] as unknown[])[t.index] = '本人が書いた文';
  }
  assert.equal(readinessTargets(pages).filter(t => t.kind === 'placeholder').length, 0);
  // 判定側も、同じ材料で「残っていない」（見本写真の説明文は判定の対象外）
  const textOnly = pages[0].blocks.map(b => b.type === 'hero' ? { ...b, data: { ...b.data, bgImageAlt: '' } } : b);
  assert.equal(hasPlaceholderText(textOnly), false);
});

const block = (id: string, type: string, data: Record<string, unknown>): Block => ({ id, type, data } as unknown as Block);
const pageOf = (...blocks: Block[]): Page[] => [{ id: 'p1', name: 'トップ', blocks } as unknown as Page];

test('繰り返し項目：位置と項目キーで指し、同じ見出しの節が2つあっても別の部品IDで区別する', () => {
  const pages = pageOf(
    block('h1', 'heading', { text: 'サービス' }),
    block('s1', 'services', { items: [{ title: '外壁', description: '本人の説明', price: '' }, { title: '屋根', description: '【例】説明を入力してください', price: '' }] }),
    block('h2', 'heading', { text: 'サービス' }),
    block('s2', 'services', { items: [{ title: '【例】メニュー名', description: '本人の説明', price: '' }] }),
  );
  const ts = readinessTargets(pages);
  assert.deepEqual(ts.map(t => [t.blockId, targetPath(t)]), [['s1', 'items.1.description'], ['s2', 'items.0.title']]);
  assert.equal(ts[0].section, 'サービス');
  assert.match(ts[0].fieldLabel, /屋根/);
  assert.match(ts[1].fieldLabel, /1件目/);   // 名前が例文なら位置で呼ぶ
});

test('古い指摘：直った・消えた・同じ値が複数で決められない、なら開かない。並べ替えで一意なら新しい位置を開く', () => {
  const items = [{ q: '本人の質問', a: '回答を入力してください' }, { q: '質問2', a: '本人の答え' }];
  const pages = pageOf(block('f', 'faq', { items }));
  const [t] = readinessTargets(pages);
  assert.equal(targetPath(t), 'items.0.a');
  // 並べ替え → 同じ値が1件だけ → 新しい位置
  const moved = pageOf(block('f', 'faq', { items: [items[1], items[0]] }));
  assert.equal(targetPath(resolveTarget(moved, t)!), 'items.1.a');
  // 直った → 開かない
  assert.equal(resolveTarget(pageOf(block('f', 'faq', { items: [{ ...items[0], a: '直した答え' }, items[1]] })), t), null);
  // 同じ例文が2か所に増え、元の位置は直っている → どちらか決められないので開かない
  const dup = pageOf(block('f', 'faq', { items: [{ q: 'x', a: '直した' }, { q: 'y', a: '回答を入力してください' }, { q: 'z', a: '回答を入力してください' }] }));
  assert.equal(resolveTarget(dup, t), null);
  // 節が消えた → 開かない
  assert.equal(resolveTarget(pageOf(block('other', 'faq', { items })), t), null);
  // 単独の欄：値が変わったら開かない
  const [h] = readinessTargets(pageOf(block('x', 'heading', { text: '見出しを入力' })));
  assert.equal(resolveTarget(pageOf(block('x', 'heading', { text: '直した見出し' })), h), null);
  assert.ok(resolveTarget(pageOf(block('x', 'heading', { text: '見出しを入力' })), h));
});

test('見本写真：最初の画面は説明文の印で、ほかは見本写真の置き場所で見分ける。差し替えると消える', () => {
  const hero = block('hero', 'hero', { heading: '足立ホーム', bgImage: '/studio/placeholders/construction-hero.jpg', bgImageAlt: 'サンプル写真。工事の様子' });
  const gal = block('g', 'gallery', { images: ['/studio/placeholders/a.jpg', 'https://example.com/mine.jpg'] });
  const ts = readinessTargets(pageOf(hero, gal)).filter(t => t.kind === 'sample-photo');
  assert.deepEqual(ts.map(t => [t.blockId, targetPath(t)]), [['hero', 'bgImage'], ['g', 'images.0']]);
  const items = checkPublishReadiness({ name: '足立ホーム', pages: pageOf(hero, gal) } as never);
  assert.equal(items.find(i => i.id === 'hero-photo')!.targets!.length, 1);
  assert.equal(items.find(i => i.id === 'sample-photos')!.level, 'better');   // 必須にしない
  const replaced = pageOf(block('hero', 'hero', { heading: '足立ホーム', bgImage: 'https://example.com/mine.jpg', bgImageAlt: '' }), block('g', 'gallery', { images: ['https://example.com/mine.jpg'] }));
  assert.equal(readinessTargets(replaced).length, 0);
  assert.equal(checkPublishReadiness({ name: '足立ホーム', pages: replaced } as never).some(i => i.id === 'sample-photos'), false);
});

test('編集欄が無い項目の例文は「これまでの編集画面で直す」に回す（勝手に消さない）', () => {
  const [t] = readinessTargets(pageOf(block('x', 'heading', { text: '本人の見出し', note: 'ここに説明' })));
  assert.equal(t.editable, false);
  assert.equal(t.field, 'note');
  assert.match(t.action, /これまでの編集画面/);
});

test('2ページ目以降の指摘は、この画面では開かない（これまでの編集画面で直す）', () => {
  const pages = [...pageOf(block('a', 'heading', { text: '本人の見出し' })), { id: 'p2', name: '会社案内', blocks: [block('b', 'heading', { text: '見出しを入力' })] } as unknown as Page];
  const [t] = readinessTargets(pages);
  assert.equal(t.pageIndex, 1);
  assert.equal(t.editable, false);
});

test('書き方の案内：業種別（工務店・美容・飲食）と共通。業種が無ければ共通。数字の例を出さない', () => {
  const c = guideFor('construction', 'services', 'items', 'description');
  const b = guideFor('beauty', 'services', 'items', 'description');
  const r = guideFor('restaurant', 'services', 'items', 'description');
  const g = guideFor('', 'services', 'items', 'description');
  assert.ok(c && b && r && g);
  assert.equal(new Set([c, b, r, g]).size, 4);
  assert.equal(guideFor('clinic', 'services', 'items', 'description'), g);   // ほかの業種は共通
  assert.equal(guideFor('construction', 'three-col', 'col3Title'), guideFor('construction', 'three-col', 'col1Title'));
  assert.equal(guideFor('construction', 'unknown', 'x'), '');
  // 実績・年数・料金の「数字の例」を案内に入れない
  for (const ind of ['construction', 'beauty', 'restaurant', '']) {
    for (const [t, f, s] of [['services', 'items', 'description'], ['price-table', 'plans', 'price'], ['three-col', 'col1Title', undefined], ['faq', 'items', 'a'], ['testimonials', 'items', 'text'], ['gallery', 'images', undefined]] as const) {
      assert.doesNotMatch(guideFor(ind, t, f, s), /[0-9０-９]+\s*(年|円|件|%|％|名)/);
    }
  }
});
