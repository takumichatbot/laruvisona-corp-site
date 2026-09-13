import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const files = [
  '../app/laruHP/analytics/page.tsx',
  '../app/laruHP/payments/page.tsx',
  '../app/laruHP/seo/page.tsx',
  '../app/laruHP/booking/page.tsx',
  '../app/laruHP/contacts/page.tsx',
];

const sources = files.map(file => ({ file, source: readFileSync(new URL(file, import.meta.url), 'utf8') }));
const pictographs = /\p{Extended_Pictographic}/u;

test('公開後の主要運用画面は端末依存の絵文字を視覚言語に使わない', () => {
  for (const { file, source } of sources) {
    assert.doesNotMatch(source, pictographs, file);
  }
});

test('分析・決済・SEO・予約・問い合わせは意味を持つ線画アイコンを使う', () => {
  const all = sources.map(({ source }) => source).join('\n');
  for (const icon of ['AlertTriangle', 'BarChart3', 'CreditCard', 'ClipboardCopy', 'RefreshCw', 'Globe2', 'Clock3']) {
    assert.match(all, new RegExp(`\\b${icon}\\b`), icon);
  }
});
