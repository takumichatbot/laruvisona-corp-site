import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('公開ページ固有のOpen Graph設定もLARU HPの共有画像を保つ', () => {
  const targets = [
    'app/laruHP/[industry]/page.tsx',
    'app/laruHP/domains/page.tsx',
    'app/laruHP/articles/page.tsx',
    'app/laruHP/articles/[slug]/page.tsx',
  ];
  for (const path of targets) {
    const source = read(path);
    assert.match(source, /LARUHP_OG_IMAGE/, `${path} が共有画像を指定していない`);
    assert.match(source, /images:\s*\[LARUHP_OG_IMAGE\]/, `${path} のopenGraphから画像が落ちる`);
  }
});

test('共有画像は専用ドメインの1200×630を使う', () => {
  const source = read('lib/laruhp-seo.ts');
  assert.match(source, /https:\/\/laruhp\.com\/opengraph-image/);
  assert.match(source, /width:\s*1200/);
  assert.match(source, /height:\s*630/);
});
