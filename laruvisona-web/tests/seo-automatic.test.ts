import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autoDescription } from '../lib/auto-description';
import { schemaTypeFor, INDUSTRY_SCHEMA_TYPE } from '../lib/industry-schema';
import { exportToHTML } from '../lib/html-export';
import { INDUSTRIES } from '../lib/laruhp-facts';
import type { Block, SEOSettings, SiteSettings } from '../types/laruHP';

const seo: SEOSettings = { title: '', description: '', keywords: '', ogTitle: '', ogDescription: '', ogImage: '' };
const settings = { colorScheme: 'professional-blue', style: '', designStyle: 'modern', larubot: false, laruseo: false, fontFamily: 'noto', customCss: '', accentColor: '#f59e0b', heroLayout: 'center', headerStyle: 'solid', animLevel: 'subtle' } as unknown as SiteSettings;

test('説明文が空でも、本文から作って空タグで公開しない', () => {
  const blocks = [
    { id: 'h', type: 'hero', data: { heading: '結い庵', subheading: '東京都国立市の、予約制のヘアサロンです。' } },
    { id: 'p', type: 'paragraph', data: { text: '朝のお手入れが楽になる切り方を、髪質を見てから決めます。' } },
  ] as unknown as Block[];
  const desc = autoDescription(blocks, '結い庵');
  assert.ok(desc.length > 10);
  assert.match(desc, /予約制のヘアサロン/);

  const html = exportToHTML([{ id: 'page-main', name: 'トップ', path: '/', blocks, seo }], seo, settings, '結い庵');
  assert.doesNotMatch(html, /<meta name="description" content="">/, '空の説明文で公開している');
  assert.match(html, /<meta name="description" content="[^"]{10,}"/);
});

test('自分で書いた説明文があれば、必ずそちらを使う', () => {
  const blocks = [{ id: 'p', type: 'paragraph', data: { text: '本文から作られるはずの文章です。' } }] as unknown as Block[];
  const own: SEOSettings = { ...seo, title: '結い庵', description: '自分で書いた説明文' };
  const html = exportToHTML([{ id: 'page-main', name: 'トップ', path: '/', blocks, seo: own }], own, settings, '結い庵');
  assert.match(html, /<meta name="description" content="自分で書いた説明文">/);
  // 本文は当然ページに出るので、見るのは meta タグの中身だけ
  const meta = /<meta name="description" content="([^"]*)">/.exec(html)?.[1] ?? '';
  assert.equal(meta, '自分で書いた説明文');
});

test('説明文は文の途中で切らない', () => {
  const blocks = [{ id: 'p', type: 'paragraph', data: { text: 'あ'.repeat(60) + '。' + 'い'.repeat(80) + '。' } }] as unknown as Block[];
  const desc = autoDescription(blocks, '店');
  assert.ok(desc.length <= 110);
  assert.ok(desc.endsWith('。') || desc.endsWith('…'));
});

test('本文が何も無くても、空文字を返さない', () => {
  assert.equal(autoDescription([], '結い庵'), '結い庵のホームページです。');
});

test('構造化データの業種が、売っている15業種すべてに対応している', () => {
  for (const industry of INDUSTRIES) {
    const type = schemaTypeFor(industry.id);
    assert.notEqual(type, 'LocalBusiness', `${industry.id}（${industry.name}）が汎用のLocalBusinessに落ちている`);
  }
  assert.equal(Object.keys(INDUSTRY_SCHEMA_TYPE).length, INDUSTRIES.length);
  assert.equal(schemaTypeFor(null), 'LocalBusiness');
  assert.equal(schemaTypeFor('知らない業種'), 'LocalBusiness');
});

test('空の項目を構造化データに出さない', () => {
  const blocks = [{ id: 'h', type: 'hero', data: { heading: '常盤台不動産', subheading: 'この街で暮らしを探している方へ。' } }] as unknown as Block[];
  const html = exportToHTML([{ id: 'page-main', name: 'トップ', path: '/', blocks, seo }], seo, settings, '常盤台不動産', { industry: 'realestate' });
  assert.match(html, /"@type": ?"RealEstateAgent"/);
  assert.doesNotMatch(html, /"url": ?""/, '空文字のURLは「URLが無い」ではなく「空がURL」と読まれる');
  assert.doesNotMatch(html, /"telephone": ?""/);
});

test('案内ページで売っている機能に、制作スタジオから届く導線がある', async () => {
  const fs = await import('node:fs');
  const read = (p: string) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
  // 「AIによる文章と画像の生成」
  const imageField = read('components/studio/ImageField.tsx');
  assert.match(imageField, /\/api\/ai\/image/, 'AI画像生成が旧エディタにしか無い状態に戻っている');
  // 「Google Analytics 連携」
  const studio = read('app/laruHP/studio/page.tsx');
  assert.match(studio, /gaTrackingId/, '測定IDを入れる場所が制作スタジオに無い');
});

test('LARUbotの用意を、黙って飛ばさない', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../lib/larubot-provision.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /if \(!process\.env\.LARU_HP_API_SECRET\) return;/,
    '鍵が無いときに無言で戻ると、課金済みなのにボットが付かない失敗が誰にも見えない');
  assert.match(src, /LARU_HP_API_SECRET が未設定/);
});
