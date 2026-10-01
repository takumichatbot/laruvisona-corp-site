// 「AIに相談」：本人が書いた事実から、その欄の文案を作る。事実を足さない・見本を事実に見せない・
// 繰り返し項目は項目の中の文章欄ごと・古い提案で別の項目を書き換えない。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  aiFields, aiData, aiFieldLabel, reviewSectionProposal, parseSectionProposal, applySectionProposal, unsupportedClaims,
} from '../lib/studio-ai';
import type { Block } from '../types/laruHP';

const services: Block = {
  id: 'svc', type: 'services',
  data: {
    heading: '住まいのご相談', columns: '3',
    items: [
      { icon: '🔧', title: '【例】リフォーム', description: '【例】どんな工事に対応しているかを書きます', price: '【例】○○円〜' },
      { icon: '', title: '外壁の塗り替え', description: '外壁の塗装をしています', price: 'お見積り' },
    ],
  },
} as unknown as Block;
const FACTS = '対応地域は足立区と葛飾区。水回りの修理とリフォームに対応。価格は現地確認後に見積もる。';

test('対象の欄：見出し・本文と、繰り返し項目の中の文章欄だけ。料金・アイコン・配列そのものは入らない', () => {
  const f = aiFields(services);
  assert.deepEqual(Object.keys(f).sort(), ['heading', 'items.0.description', 'items.0.title', 'items.1.description', 'items.1.title', 'subtext'].sort());
  assert.ok(!('items' in f) && !('items.0.price' in f) && !('items.0.icon' in f) && !('columns' in f));
  const d = aiData(services) as { items: Record<string, string>[] };
  assert.deepEqual(Object.keys(d.items[0]).sort(), ['description', 'title']);
  assert.equal(aiFieldLabel(services, 'items.0.description'), '1件目の説明');
  assert.equal(aiFieldLabel(services, 'items.1.description'), '外壁の塗り替えの説明');
  // 口コミ（お客様の声）は対象にしない
  assert.deepEqual(aiFields({ id: 't', type: 'testimonials', data: { heading: '声', items: [{ name: 'a', text: 'b' }] } } as unknown as Block), { heading: '声' });
});

test('本人の事実が無いと、見本（【例】）を事実の文章に変える提案は受け付けない', () => {
  assert.equal(parseSectionProposal(services, { changes: { 'items.0.description': '水回りの修理に対応します。' } }), null);
});

test('本人の事実があれば、その事実で書いた見本の欄の文案を受け付け、使った情報も持つ', () => {
  const r = reviewSectionProposal(services, { changes: { 'items.0.description': '足立区・葛飾区で、水回りの修理とリフォームを承ります。費用は現地を確認してからお見積りします。' }, missing: [] }, { facts: FACTS });
  assert.ok(r.proposal);
  assert.equal(r.proposal!.facts, FACTS);
  assert.ok(r.proposal!.items?.['items.0.description']);
});

test('本人の情報に無い事実（年数・資格・保証・料金・別の地名・電話）が入った欄は外し、理由を返す', () => {
  for (const bad of [
    '創業30年の実績で、足立区の水回りに対応します。',
    '一級建築士が担当し、10年保証をお付けします。',
    '水回りの修理は5,000円から。',
    '足立区・荒川区で対応します。',
    'お電話でお気軽に。',
  ]) {
    const r = reviewSectionProposal(services, { changes: { 'items.0.description': bad } }, { facts: FACTS });
    assert.equal(r.proposal, null, bad);
    assert.equal(r.dropped.length, 1, bad);
  }
  // 良い欄は残し、悪い欄だけ外す
  const mixed = reviewSectionProposal(services, { changes: { 'items.0.description': '足立区と葛飾区で、水回りの修理とリフォームに対応します。', 'items.0.title': '水回りの修理・リフォーム（創業30年）' } }, { facts: FACTS });
  assert.deepEqual(Object.keys(mixed.proposal!.changes), ['items.0.description']);
  assert.equal(mixed.dropped[0].key, 'items.0.title');
  assert.deepEqual(unsupportedClaims('葛飾区でも対応', FACTS), []);
  assert.deepEqual(unsupportedClaims('対応足立区で', FACTS), []);   // 前に付いた語ごと拾っても、地名の部分で照合
});

test('足りない情報だけが返ったとき：文章は変えず、必要な情報を短く返す', () => {
  const r = reviewSectionProposal(services, { changes: {}, missing: ['対応している工事の種類', '<b>x</b>'] }, { facts: '足立区' });
  assert.equal(r.proposal, null);
  assert.deepEqual(r.missing, ['対応している工事の種類']);
});

test('許可していない欄・配列そのもの・任意のパス・HTML は、提案全体を捨てる', () => {
  for (const bad of [
    { changes: { items: [] } },
    { changes: { 'items.0.price': '1円' } },
    { changes: { 'items.5.title': '無い項目' } },
    { changes: { '__proto__.x': 'a' } },
    { changes: { 'items.1.title': '<b>外壁</b>' } },
    { changes: { heading: 'a' }, extra: true },
  ]) assert.equal(parseSectionProposal(services, bad, { facts: FACTS }), null, JSON.stringify(bad));
});

test('採用：その項目の文章欄だけを変え、料金・アイコン・ほかの項目・ほかの欄はそのまま。元のデータは書き換えない', () => {
  const p = parseSectionProposal(services, { changes: { 'items.0.description': '足立区と葛飾区で、水回りの修理とリフォームに対応します。' } }, { facts: FACTS })!;
  const out = applySectionProposal(services, p, ['items.0.description'])!;
  const items = (out.data as { items: Record<string, string>[] }).items;
  assert.equal(items[0].description, '足立区と葛飾区で、水回りの修理とリフォームに対応します。');
  assert.equal(items[0].price, '【例】○○円〜');
  assert.equal(items[0].icon, '🔧');
  assert.equal(items[0].title, '【例】リフォーム');
  assert.deepEqual(items[1], (services.data as { items: unknown[] }).items[1]);
  assert.equal((out.data as { heading: string }).heading, '住まいのご相談');
  assert.equal(((services.data as { items: Record<string, string>[] }).items[0]).description, '【例】どんな工事に対応しているかを書きます');
});

test('古い提案：並べ替え・削除・提案後の手編集（同じ項目のほかの欄も）のあとは採用しない', () => {
  const p = parseSectionProposal(services, { changes: { 'items.0.description': '足立区と葛飾区で、水回りの修理とリフォームに対応します。' } }, { facts: FACTS })!;
  const items = (services.data as { items: Record<string, string>[] }).items;
  const withItems = (list: unknown[]) => ({ ...services, data: { ...services.data, items: list } }) as Block;
  assert.equal(applySectionProposal(withItems([items[1], items[0]]), p, ['items.0.description']), null);   // 並べ替え
  assert.equal(applySectionProposal(withItems([items[1]]), p, ['items.0.description']), null);             // 削除
  assert.equal(applySectionProposal(withItems([{ ...items[0], description: '手で直した' }, items[1]]), p, ['items.0.description']), null);
  assert.equal(applySectionProposal(withItems([{ ...items[0], price: 'お見積り' }, items[1]]), p, ['items.0.description']), null);
  assert.equal(applySectionProposal({ ...services, id: 'other' } as Block, p, ['items.0.description']), null);
  assert.ok(applySectionProposal(services, p, ['items.0.description']));
});

test('AIへの依頼：見本の文章は空欄として渡し、本人の事実と分ける。公開メタデータには出さない', () => {
  const route = readFileSync(new URL('../app/api/ai/section-proposal/route.ts', import.meta.url), 'utf8');
  assert.match(route, /見本（【例】など）の文章は、本人の事実として AI に渡さない/);
  assert.match(route, /fields = Object\.fromEntries\(Object\.entries\(scope\)\.filter\(\(\[k\]\) => !blank\.includes\(k\)\)\)/);
  assert.match(route, /blank: facts \? blank : \[\]/);
  assert.match(route, /実績・年数・料金・許可・資格・保証・口コミ・営業時間・住所・電話・対応範囲/);
  assert.match(route, /requireAiAccess\(sb,user\.id,'studio-section',12\)/);   // 回数の上限は既存のまま
  const exp = readFileSync(new URL('../lib/html-export.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(exp, /facts|studio-ai/);
});
