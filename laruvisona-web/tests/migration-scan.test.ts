import test from 'node:test';
import assert from 'node:assert/strict';
import { crawlMigrationPages, inspectMigrationHtml, migrationSummary, migrationUrl } from '../lib/migration-scan.ts';

const html = `<!doctype html><html><head>
<title> 現在の店 &amp; 会社 </title>
<meta name="description" content="現在の説明です">
<link rel="canonical" href="/about">
</head><body><nav><a href="/nav">案内</a></nav><h1>私たちについて</h1>
<p>引き継ぐ本文です。</p>
<a href="/menu?from=top#price">メニュー</a><a href="https://other.example/x">外部</a>
<a href="/wp-admin/">管理</a><a href="/asset.pdf">資料</a>
<img src="/shop.jpg" alt="店舗 外観"><img data-src="/staff.jpg" alt="担当者">
<script><a href="/trap">罠</a></script></body></html>`;

test('既存サイトのSEO・本文・画像をページ単位で棚卸しする', () => {
  const page = inspectMigrationHtml(html, 'https://example.com/about');
  assert.equal(page.title, '現在の店 & 会社');
  assert.equal(page.description, '現在の説明です');
  assert.equal(page.canonical, 'https://example.com/about');
  assert.equal(page.heading, '私たちについて');
  assert.match(page.text, /引き継ぐ本文/);
  assert.deepEqual(page.images, [
    { url: 'https://example.com/shop.jpg', alt: '店舗 外観' },
    { url: 'https://example.com/staff.jpg', alt: '担当者' },
  ]);
});

test('巡回候補は同一originの公開HTMLだけに絞りクエリと断片を落とす', () => {
  const page = inspectMigrationHtml(html, 'https://example.com/about');
  assert.deepEqual(page.links, ['https://example.com/nav', 'https://example.com/menu']);
});

test('移行診断の不足件数をページ別に数える', () => {
  const complete = inspectMigrationHtml(html, 'https://example.com/about');
  const missing = inspectMigrationHtml('<main>本文だけ</main>', 'https://example.com/plain');
  assert.deepEqual(migrationSummary([complete, missing]), {
    pageCount: 2, imageCount: 2, missingTitleCount: 1,
    missingDescriptionCount: 1, missingHeadingCount: 1,
  });
});

test('スキーム省略URLをhttpsとして正規化する', () => {
  assert.equal(migrationUrl(' example.com/path#x ').toString(), 'https://example.com/path');
});

test('壊れた数値文字参照が混じっても診断全体を落とさない', () => {
  const page = inspectMigrationHtml('<title>店&#9999999999;</title><h1>案内&#xD800;</h1>', 'https://example.com/');
  assert.equal(page.title, '店');
  assert.equal(page.heading, '案内');
});

test('同じサイトを上限まで巡回し、途中ページの失敗と外部URLを混ぜない', async () => {
  const calls: string[] = [];
  const pages = await crawlMigrationPages('https://example.com/', async url => {
    calls.push(url);
    if (url.endsWith('/broken')) throw new Error('broken');
    const index = url === 'https://example.com/' ? 0 : Number(new URL(url).pathname.slice(1));
    const links = index === 0
      ? '<a href="/1">1</a><a href="/broken">壊れ</a><a href="https://outside.example/x">外部</a>'
      : index < 12 ? `<a href="/${index + 1}">次</a>` : '';
    return { html: `<title>${index}</title><h1>${index}</h1><p>本文が十分にあります</p>${links}`, url };
  });
  assert.equal(pages.length, 8);
  assert.equal(pages.at(-1)?.path, '/7');
  assert.ok(calls.includes('https://example.com/broken'));
  assert.equal(calls.some(url => url.includes('outside.example')), false);
});
