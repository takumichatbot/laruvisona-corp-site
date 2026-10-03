import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeStarterSite } from '../lib/studio-start';
import { exportToHTML } from '../lib/html-export';
import { normalizeBusinessFacts, factsFromIntake, factsForSection, relevantFactKeys, publicContactFacts, hasFacts } from '../lib/business-facts';

const intake = { industry: 'construction', name: '足立ホーム工房', area: '東京都足立区', audience: '足立区で住まいを考えている方',
  description: '暮らしの話を伺うところから、住まいづくりを始めます。', goal: 'contact', phone: '03-1234-5678' } as never;

test('本人が打った答えだけを控える。見本・知らない欄・長すぎる文は入らない', () => {
  const f = factsFromIntake(intake);
  assert.deepEqual(f, { area: '東京都足立区', targetAudience: '足立区で住まいを考えている方', shortDescription: '暮らしの話を伺うところから、住まいづくりを始めます。' });
  assert.deepEqual(factsFromIntake({ area: '', audience: '', description: '' }), {});
  assert.equal(hasFacts(factsFromIntake({ area: '', audience: '', description: '' })), false);
  const n = normalizeBusinessFacts({
    area: '【例】足立区', shortDescription: 'ここに説明を入力してください', servicesSummary: 'x'.repeat(999),
    notifyEmail: 'owner@example.com', password: 'secret', stripeCustomerId: 'cus_123', internalMemo: '社内メモ',
    contactPreference: '電話\u0000とフォーム',
  });
  assert.equal(n.area, undefined, '見本の文は事実にしない');
  assert.equal(n.shortDescription, undefined);
  assert.equal(n.servicesSummary?.length, 300);
  assert.equal(n.contactPreference, '電話とフォーム');
  assert.deepEqual(Object.keys(n).sort(), ['contactPreference', 'servicesSummary']);
  assert.deepEqual(normalizeBusinessFacts(['a']), {});
  assert.deepEqual(normalizeBusinessFacts(null), {});
});

test('節に関係する情報だけを渡す（全部はまとめて渡さない）', () => {
  const f = { area: '足立区', shortDescription: '住まいの相談', targetAudience: '子育て世帯', servicesSummary: '新築・リフォーム', contactPreference: '電話とフォーム' };
  assert.deepEqual(relevantFactKeys({ type: 'services' }), ['servicesSummary', 'area']);
  const s = factsForSection(f, { type: 'contact' }, '足立ホーム工房');
  assert.match(s, /連絡・予約のしかた：電話とフォーム/);
  assert.ok(!s.includes('新築'));
  assert.equal(factsForSection(f, { type: 'gallery' }), '');
  assert.equal(factsForSection({}, { type: 'hero' }, '足立ホーム工房'), '', '情報が無ければ名前だけを渡さない');
});

test('事業者情報（検索・SEO）は読むだけ。見本は出さない', () => {
  assert.deepEqual(publicContactFacts({ phone: '03-1234-5678', address: '足立区1-2-3', postalCode: '120-0001', openingHours: ['Mo-Fr 09:00-18:00'] }), [
    { label: '電話', value: '03-1234-5678' }, { label: '住所', value: '〒120-0001 足立区1-2-3' }, { label: '営業時間', value: 'Mo-Fr 09:00-18:00' },
  ]);
  assert.deepEqual(publicContactFacts({ phone: '【例】03-0000-0000' }), []);
  assert.deepEqual(publicContactFacts(null), []);
});

test('会社の情報は公開HTML・検索向けの情報（JSON-LD・lhpmeta）に出ない', () => {
  const s = makeStarterSite(intake, 'calm');
  const secret = 'ひみつの控えXYZ';
  const settings = { ...s.settings, businessFacts: { servicesSummary: secret, area: secret }, businessInfo: { name: '足立ホーム工房', phone: '03-1234-5678' } };
  const html = exportToHTML(s.pages, s.pages[0].seo!, settings as never, s.name, { name: s.name, industry: 'construction', siteId: 'x', slug: 'x' });
  assert.ok(!html.includes(secret));
  const meta = html.match(/<!--lhpmeta:([A-Za-z0-9+/=]+)-->/);
  if (meta) assert.ok(!Buffer.from(meta[1], 'base64').toString('utf8').includes(secret));
  assert.ok(!html.includes('businessFacts'));
});

test('制作画面：会社の情報は保存の差分にだけ入り、公開用の書き出し（toExportSettings）には入らない', () => {
  const src = readFileSync(new URL('../app/laruHP/studio/page.tsx', import.meta.url), 'utf8');
  const exp = src.slice(src.indexOf('function toExportSettings'), src.indexOf('/* ── プレビュー'));
  assert.ok(exp.length > 100 && !exp.includes('businessFacts'));
  assert.match(src, /businessFacts: normalizeBusinessFacts\(s\.settings\.businessFacts\)/);
  // 以前のサイト（会社の情報が無い）は、鍵ごと送らない
  assert.match(src, /s\.settings\.businessFacts !== undefined/);
});
