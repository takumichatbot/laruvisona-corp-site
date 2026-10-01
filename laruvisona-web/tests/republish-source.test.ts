// 一括再生成が「公開時点の中身」だけから作り直すこと（未公開の下書きを公開側へ出さない）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { canonicalJson, republishSource } from '../lib/republish-source';

const doc = (heading: string) => ({ v: 2, pages: [{ id: 'p', name: 'トップ', path: '/', blocks: [
  { id: 'hero-1', type: 'hero', data: { heading } },
  { id: 'text-1', type: 'paragraph', data: { text: '本文' } },
] }] });
const seo = { title: 't', description: 'd' };
const settings = { designStyle: 'modern', accentColor: '#123456' };
const html = '<section data-lhp-block="hero-1">A</section><section data-lhp-block="text-1"></section><!--lhpv:21-->';

test('下書き＝最後の公開時点の中身なら、公開時点の中身で作り直す', () => {
  const r = republishSource({ blocks_json: doc('A'), seo_json: seo, settings_json: settings, published_html: html },
    { blocks_json: doc('A'), seo_json: { description: 'd', title: 't' }, settings_json: settings });
  assert.equal(r.ok, true);
  if (r.ok) assert.match(JSON.stringify(r.blocks), /"heading":"A"/);
});

test('下書きに未公開の文章Bがあれば書かない（Bを公開側へ出さない）', () => {
  const r = republishSource({ blocks_json: doc('B'), seo_json: seo, settings_json: settings, published_html: html },
    { blocks_json: doc('A'), seo_json: seo, settings_json: settings });
  assert.deepEqual(r, { ok: false, reason: 'unpublished_changes' });
});

test('下書きだけで案を採用した（設定だけ違う）場合も書かない', () => {
  const r = republishSource({ blocks_json: doc('A'), seo_json: seo, settings_json: { ...settings, styleDirection: 'immersive', motionProfile: 'calm' }, published_html: html },
    { blocks_json: doc('A'), seo_json: seo, settings_json: settings });
  assert.deepEqual(r, { ok: false, reason: 'unpublished_changes' });
});

test('公開時点の版が無ければ書かない', () => {
  assert.deepEqual(republishSource({ blocks_json: doc('A'), seo_json: seo, settings_json: settings, published_html: html }, null),
    { ok: false, reason: 'no_snapshot' });
});

test('公開HTMLに版に無い部品が出ている（版の保存に失敗した公開など）なら書かない', () => {
  const r = republishSource({ blocks_json: doc('A'), seo_json: seo, settings_json: settings,
    published_html: html.replace('</section><!--', '</section><section data-lhp-block="new-9"></section><!--') },
  { blocks_json: doc('A'), seo_json: seo, settings_json: settings });
  assert.deepEqual(r, { ok: false, reason: 'snapshot_mismatch' });
});

test('キーの順番だけが違うJSONは同じとみなす（jsonb は順番を保たない）', () => {
  assert.equal(canonicalJson({ b: 1, a: { d: [1, { y: 2, x: 1 }], c: null } }), canonicalJson({ a: { c: null, d: [1, { x: 1, y: 2 }] }, b: 1 }));
  assert.notEqual(canonicalJson({ a: [1, 2] }), canonicalJson({ a: [2, 1] }));
});

test('一括再生成の経路は下書きの列から書き出さない（版を読んで判定する）', () => {
  const src = fs.readFileSync(new URL('../app/api/admin/republish-all/route.ts', import.meta.url), 'utf8');
  assert.match(src, /from\('site_versions'\)/);
  assert.match(src, /republishSource\(site, v\.row\)/);
  assert.doesNotMatch(src, /site\.settings_json as SiteSettings/);
  assert.doesNotMatch(src, /site\.blocks_json as Block/);
});
