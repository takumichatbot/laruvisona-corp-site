import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('公開ページはOG画像を必ず指定する（共通の1枚か、そのページ専用の絵）', () => {
  // 2026-09-17: 記事11本・業種15本が全部おなじ絵だった。/api/og で作れるのに使っていなかった。
  // 「共通の1枚を使うこと」ではなく「必ず指定してあること」を見る。
  const targets = [
    'app/laruHP/[industry]/page.tsx',
    'app/laruHP/domains/page.tsx',
    'app/laruHP/articles/page.tsx',
    'app/laruHP/articles/[slug]/page.tsx',
    'app/laruHP/vs/[competitor]/page.tsx',
  ];
  for (const path of targets) {
    const source = read(path);
    assert.match(source, /LARUHP_OG_IMAGE|laruhpOgImage/, `${path} が共有画像を指定していない`);
    assert.match(source, /images:\s*\[(LARUHP_OG_IMAGE|laruhpOgImage\()/, `${path} のopenGraphから画像が落ちる`);
  }
});

test('ページ専用のOG画像は、画像を作る入口を指す', async () => {
  const { laruhpOgImage } = await import('../lib/laruhp-seo');
  const og = laruhpOgImage('記事のタイトル', '説明');
  assert.match(og.url, /^https:\/\/laruvisona\.jp\/api\/og\?/);
  assert.match(og.url, /title=/);
  assert.equal(og.width, 1200);
  assert.equal(og.height, 630);
});

test('共有画像は専用ドメインの1200×630を使う', () => {
  const source = read('lib/laruhp-seo.ts');
  assert.match(source, /https:\/\/laruhp\.com\/opengraph-image/);
  assert.match(source, /width:\s*1200/);
  assert.match(source, /height:\s*630/);
});
