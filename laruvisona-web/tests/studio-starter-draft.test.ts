import test from 'node:test';
import assert from 'node:assert/strict';
import { makeStarterSite, phoneHref, STARTER_EXAMPLES } from '../lib/studio-start';
import { INDUSTRY_TEMPLATES } from '../lib/templates';
import { checkPublishReadiness, placeholderPlaces } from '../lib/publish-readiness';
import { orderForGoal } from '../lib/studio-schema';
import { exportToHTML } from '../lib/html-export';
import type { Block } from '../types/laruHP';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { editStudioBlock, withoutSampleMarkOnReplace } from '../lib/studio-image';

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
  assert.match(String(noArea.pages[0].blocks.find(b => b.type === 'three-col')!.data.col1Text), /○○市/);
});

test('工務店・美容室・整体の下書きに「入力してください」を残さない', () => {
  for (const industry of ['construction', 'beauty', 'clinic'])
    assert.doesNotMatch(JSON.stringify(make(industry).pages[0].blocks), /入力してください/, industry);
});

test('全15業種：初期ページに「入力してください」・空の見出し・架空の数字・電話番号を出さない', () => {
  for (const industry of Object.keys(INDUSTRY_TEMPLATES)) {
    const blocks = make(industry, { area: '' }).pages[0].blocks;
    const text = JSON.stringify(blocks);
    assert.doesNotMatch(text, /入力してください|ここに[^書]|lorem/i, industry);
    blocks.forEach((b, i) => {
      if (b.type === 'heading') assert.ok(blocks[i + 1] && blocks[i + 1].type !== 'heading', `${industry}: 空の見出し`);
    });
    const strings: string[] = [];
    const walk = (v: unknown, k = ''): void => {
      if (typeof v === 'string') { if (!/Color|Image|Link|anchor|layout|columns|Ratio|Width|Height/i.test(k)) strings.push(v); }
      else if (Array.isArray(v)) v.forEach(x => walk(x, k));
      else if (v && typeof v === 'object') for (const [kk, vv] of Object.entries(v)) walk(vv, kk);
    };
    blocks.forEach(b => walk(b.data));
    for (const t of strings) assert.doesNotMatch(t.replace(/^\d\. /, ''), /\d|No\.?1|保証|満足度/, `${industry}: ${t}`);
    assert.ok(!text.includes('tel:'), `${industry}: 入力していない電話番号`);
  }
});

test('全15業種：見本写真には見本の印があり、業種と無関係な写真を使わない', () => {
  const mismatched = ['/company/concepts/architecture.webp', '/company/concepts/ceramics.webp'];
  for (const industry of Object.keys(INDUSTRY_TEMPLATES)) {
    const s = make(industry);
    const hero = s.pages[0].blocks.find(b => b.type === 'hero')!;
    assert.match(String(hero.data.bgImageAlt), /^サンプル写真。/, industry);
    assert.ok(!mismatched.includes(String(hero.data.bgImage)), `${industry}: ${hero.data.bgImage}`);
    assert.ok(existsSync(join('public', String(hero.data.bgImage))), `${industry}: 画像ファイルが無い`);
    if (industry !== 'hotel') assert.notEqual(hero.data.bgImage, '/company/concepts/retreat.webp', industry);
    assert.equal(checkPublishReadiness(s).find(i => i.id === 'hero-photo')!.ok, false, industry);
  }
});

test('物販：通販の決済・送料を見本に出さず、商品・お店の特徴・営業時間・問い合わせがそろう', () => {
  const blocks = make('retail').pages[0].blocks;
  const text = JSON.stringify(blocks);
  assert.doesNotMatch(text, /送料|返品|カート|決済/);
  for (const t of ['主な商品', 'お店について', '営業時間・定休日', '在庫・商品のご相談']) assert.ok(text.includes(t), t);
  assert.ok(blocks.some(b => b.type === 'contact'));
});

test('飲食：料理・お店の特徴・営業時間・来店方法が【例】で分かる', () => {
  const text = JSON.stringify(make('restaurant').pages[0].blocks);
  for (const t of ['【例】季節の食材を使った○○料理', '【例】食材・調理法・店内づくり', '【例】営業時間と定休日を書きます', '【例】○○駅から徒歩○分']) assert.ok(text.includes(t), t);
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

test('公開の準備：例文が残る節を名前で示す。見本写真は「直したほうが良いこと」で案内する', () => {
  const s = make('construction');
  const places = placeholderPlaces(s.pages);
  assert.ok(places.includes('私たちの強み'));
  assert.ok(places.includes('住まいのご相談'));
  assert.ok(places.includes('ご相談からの流れ'));
  assert.ok(!places.some(p => p.includes('写真')), '写真は必須側に出さない');
  const ready = checkPublishReadiness(s);
  assert.match(ready.find(i => i.id === 'placeholder')!.detail, /残っている場所：.*私たちの強み/);
  const photo = ready.find(i => i.id === 'hero-photo')!;
  assert.equal(photo.level, 'better');
  assert.equal(photo.ok, false);
  assert.match(photo.detail, /見本の写真のまま/);
});

test('見本写真の判定は、差し替え時に外れる見本の印で行う（URLでは判定しない）', () => {
  const s = make('construction');
  const hero = s.pages[0].blocks.find(b => b.type === 'hero')!;
  const replaced = editStudioBlock(hero, 'bgImage', 'https://example.com/my-house.jpg');
  assert.equal(replaced.data.bgImageAlt, '');
  s.pages[0].blocks = s.pages[0].blocks.map(b => b.id === hero.id ? replaced : b);
  assert.equal(checkPublishReadiness(s).find(i => i.id === 'hero-photo')!.ok, true);
  // 同じ見本URLでも、本人が選び直して印が無ければ本人の写真として扱う
  const own = make('construction');
  for (const b of own.pages[0].blocks) if (b.type === 'hero') b.data.bgImageAlt = '施工した家の外観';
  assert.equal(checkPublishReadiness(own).find(i => i.id === 'hero-photo')!.ok, true);
  // 編集画面（ビルダー）で差し替えたときも同じ
  assert.equal(withoutSampleMarkOnReplace(hero.data, { ...hero.data, bgImage: '/x.jpg' }).bgImageAlt, '');
  assert.equal(withoutSampleMarkOnReplace(hero.data, { ...hero.data, heading: 'x' }).bgImageAlt, hero.data.bgImageAlt, '写真以外の編集では外さない');
});

test('文章を直し終えて見本写真だけ残るときは、公開を止めずに差し替えを勧める', () => {
  const s = make('construction');
  s.pages[0].blocks = s.pages[0].blocks.filter(b => b.type === 'hero' || b.type === 'contact');
  const ready = checkPublishReadiness(s);
  assert.equal(ready.find(i => i.id === 'placeholder')!.ok, true);
  assert.equal(ready.find(i => i.id === 'hero-photo')!.ok, false);
});

test('書き方の見本に、架空の数字（金額・日数・許可番号）を入れない', () => {
  for (const industry of ['construction', 'beauty', 'clinic']) {
    const examples = JSON.stringify(make(industry).pages[0].blocks).match(/【例】[^"]*/g) || [];
    assert.ok(examples.length > 0, industry);
    for (const t of examples) assert.doesNotMatch(t, /\d|万円|第.*号/, `${industry}: ${t}`);
  }
});

test('公開前の確認は、保存済みのサイトを書き換えない', () => {
  const s = make('construction', { phone: '03-1234-5678' });
  const before = JSON.stringify(s);
  checkPublishReadiness(s);
  placeholderPlaces(s.pages);
  assert.equal(JSON.stringify(s), before);
});
