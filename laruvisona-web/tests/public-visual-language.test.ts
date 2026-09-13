import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { exportToHTML, EXPORT_VERSION } from '../lib/html-export';

const seo = { title: '公開テスト', description: '説明', keywords: '', ogTitle: '', ogDescription: '', ogImage: '' };
const settings = {
  colorScheme: 'blue', style: 'clean', designStyle: 'modern',
  larubot: false, laruseo: false, accentColor: '#174f47',
  heroLayout: 'center' as const, headerStyle: 'transparent' as const,
  animLevel: 'none' as const,
};

function render(blocks: Array<{ id: string; type: string; data: Record<string, unknown> }>) {
  return exportToHTML([
    { id: 'home', name: 'ホーム', path: '/', seo, blocks: blocks as never },
  ], seo, settings, '公開テスト', { siteId: '11111111-1111-4111-8111-111111111111' });
}

const pictographs = /[😀-🙏🌀-🫿🚀-🛿☀-⛿✀-➿]/u;

test('公開サイトの特徴・サービスは端末依存の絵文字を静かな連番へ置き換える', () => {
  const html = render([
    { id: 'features', type: 'three-col', data: {
      col1Icon: '🏆', col1Title: '設計', col1Text: '説明',
      col2Icon: '🌿', col2Title: '運用', col2Text: '説明',
      col3Icon: '', col3Title: '改善', col3Text: '説明',
    } },
    { id: 'services', type: 'services', data: { heading: 'サービス', items: [
      { icon: '🍽', title: '相談', description: '説明', price: '要相談' },
      { icon: 'A', title: '設計', description: '説明', price: '' },
    ] } },
  ]);
  assert.doesNotMatch(html, pictographs);
  assert.match(html, />01<\/span>/);
  assert.match(html, />02<\/span>/);
  assert.match(html, /lhp-editorial-mark-text">A<\/span>/, '顧客が入力した短い文字記号まで消している');
});

test('ショップ・会員・フォーム・予約・チャットの既定表示に絵文字を混ぜない', () => {
  const html = render([
    { id: 'shop', type: 'shop-grid', data: { heading: '商品' } },
    { id: 'member', type: 'member-gate', data: { heading: '会員向け', teaser: 'ログインしてください' } },
    { id: 'contact', type: 'contact', data: { heading: 'お問い合わせ', fields: ['name', 'email', 'message'] } },
    { id: 'booking', type: 'booking', data: { heading: '予約', serviceTypes: ['相談'], timeSlots: ['10:00'] } },
    { id: 'bot', type: 'larubot', data: { primaryColor: '#174f47', position: 'bottom-right' } },
  ]);
  assert.doesNotMatch(html, pictographs);
  assert.match(html, /商品画像/);
  assert.match(html, /会員限定/);
  assert.match(html, /チャットで相談する/);
  assert.match(html, /送信が完了しました/);
});

test('購入完了表示も文体をそろえ、公開HTMLの版を更新する', () => {
  const published = readFileSync(new URL('../components/PublishedSite.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(published, pictographs);
  assert.match(published, /ご購入ありがとうございます。確認メールをお送りしました。/);
  assert.equal(EXPORT_VERSION, 16);
});
