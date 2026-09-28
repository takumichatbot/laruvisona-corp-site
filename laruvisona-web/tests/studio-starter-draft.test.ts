import test from 'node:test';
import assert from 'node:assert/strict';
import { makeStarterSite, phoneHref, STARTER_EXAMPLES } from '../lib/studio-start';
import { INDUSTRY_TEMPLATES } from '../lib/templates';
import { checkPublishReadiness, placeholderPlaces } from '../lib/publish-readiness';
import { orderForGoal } from '../lib/studio-schema';
import { exportToHTML } from '../lib/html-export';
import type { Block } from '../types/laruHP';

const base = { name: '足立ホーム', area: '東京都足立区', audience: '', description: '' };
const make = (industry: string, extra: Record<string, string> = {}) =>
  makeStarterSite({ ...base, industry, goal: STARTER_EXAMPLES[industry]?.goal ?? 'contact', ...extra } as never, 'strong');

test('見出しは、すぐ下の中身の前に置かれ、中身の無い見出しは残らない（全業種）', () => {
  for (const industry of Object.keys(INDUSTRY_TEMPLATES)) {
    const blocks = make(industry).pages[0].blocks;
    blocks.forEach((b, i) => {
      if (b.type !== 'heading') return;
      const next = blocks[i + 1];
      assert.ok(next && next.type !== 'heading', `${industry}: ${b.data.text} の下に中身がない`);
      assert.ok(!String(next.data.heading ?? '').trim(), `${industry}: ${b.data.text} と ${next.data.heading} が2段になっている`);
    });
  }
});

test('工務店：「私たちの強み」の直下に3つの枠。整体：「こんなお悩み」の直下に3つの枠', () => {
  const c = make('construction').pages[0].blocks;
  const i = c.findIndex(b => b.type === 'heading' && b.data.text === '私たちの強み');
  assert.equal(c[i + 1].type, 'three-col');
  const k = make('clinic').pages[0].blocks;
  const j = k.findIndex(b => b.type === 'heading' && b.data.text === 'こんなお悩みありませんか？');
  assert.equal(k[j + 1].type, 'three-col');
  assert.equal(j, 1, '最初の画面のすぐ下');
});

test('並べ替えても、見出しと中身はひと組のまま', () => {
  const blocks: Block[] = [
    { id: 'h', type: 'hero', data: {} },
    { id: 'a', type: 'heading', data: { text: 'A' } },
    { id: 'b', type: 'three-col', data: {} },
    { id: 'c', type: 'contact', data: {} },
  ];
  assert.deepEqual(orderForGoal(blocks, 'contact').map(b => b.id), ['h', 'c', 'a', 'b']);
});

test('工務店の下書き：記入欄ではなく書き方の見本。対応地域には入力した地域が入る。公開前の確認では止まる', () => {
  const s = make('construction');
  const text = JSON.stringify(s.pages[0].blocks);
  assert.doesNotMatch(text, /入力してください/);
  const col = s.pages[0].blocks.find(b => b.type === 'three-col')!;
  assert.deepEqual([col.data.col1Title, col.data.col2Title, col.data.col3Title], ['対応地域', '許可・保険', '工期・費用の目安']);
  assert.match(String(col.data.col1Text), /^【例】東京都足立区を中心に/);
  for (const n of [1, 2, 3]) assert.match(String(col.data[`col${n}Text`]), /^【例】/);
  assert.equal(checkPublishReadiness(s).find(i => i.id === 'placeholder')!.ok, false);
  // 地域が空でも、別の地域名を作らない
  const noArea = make('construction', { area: '' });
  assert.match(String(noArea.pages[0].blocks.find(b => b.type === 'three-col')!.data.col1Text), /〇〇市/);
});

test('書き方の見本は、本人が書いた文を上書きしない', () => {
  const s = make('beauty', { description: '朝の髪を楽にするサロンです。' });
  assert.ok(JSON.stringify(s.pages).includes('朝の髪を楽にするサロンです。'));
});

test('電話番号：入れた人にだけ、電話するボタンと連絡欄の案内が付く', () => {
  assert.equal(phoneHref('03-1234-5678'), 'tel:0312345678');
  assert.equal(phoneHref('０３－１２３４－５６７８'), 'tel:0312345678');
  assert.equal(phoneHref('+81 3 1234 5678'), 'tel:+81312345678');
  assert.equal(phoneHref('電話してね'), '');
  assert.equal(phoneHref('123'), '');
  const s = make('construction', { phone: '03-1234-5678' });
  const cta = s.pages[0].blocks.find(b => b.type === 'cta')!;
  assert.equal(cta.data.buttonLink, 'tel:0312345678');
  assert.match(String(cta.data.buttonText), /03-1234-5678/);
  assert.notEqual(cta.data.bgColor, s.settings.design.accent, 'ボタン（差し色）が帯に溶けない');
  const contact = s.pages[0].blocks.find(b => b.type === 'contact')!;
  assert.match(String(contact.data.subtext), /お電話（03-1234-5678）でも承ります/);
  const html = exportToHTML(s.pages, s.pages[0].seo!, s.settings, s.name);
  assert.ok(html.includes('href="tel:0312345678"'));
  assert.ok(!JSON.stringify(make('construction').pages).includes('tel:'), '入れていなければ電話の導線は作らない');
  assert.ok(!JSON.stringify(make('construction', { phone: 'abc' }).pages).includes('tel:'));
});

test('公開の準備：例文が残る節を名前で示し、見本の写真を「入っています」にしない', () => {
  const s = make('construction');
  const places = placeholderPlaces(s.pages);
  assert.ok(places.includes('最初の画面の写真'));
  assert.ok(places.includes('私たちの強み'));
  assert.ok(places.includes('住まいのご相談'));
  const photo = checkPublishReadiness(s).find(i => i.id === 'hero-photo')!;
  assert.equal(photo.ok, false);
  for (const b of s.pages[0].blocks) if (b.type === 'hero') b.data.bgImageAlt = '施工した家の外観';
  assert.equal(checkPublishReadiness(s).find(i => i.id === 'hero-photo')!.ok, true);
  assert.ok(!placeholderPlaces(s.pages).includes('最初の画面の写真'));
});
