import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pagesFromBlocksJson, portableSettings, exportFileName } from '../lib/site-export';
import type { Block, Page, SEOSettings, SiteSettings } from '../types/laruHP';

const code = (p: string) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const seo = { title: 'T', description: 'D', keywords: '', ogTitle: '', ogDescription: '', ogImage: '' } as SEOSettings;

test('v1（Block[]）の保存形式でも1ページとして読める', () => {
  const blocks = [{ id: 'a', type: 'hero', data: {} }] as unknown as Block[];
  const pages = pagesFromBlocksJson(blocks, seo);
  assert.equal(pages.length, 1);
  assert.equal(pages[0].blocks.length, 1);
  assert.equal(pages[0].seo.title, 'T');
});

test('v2（pages）の保存形式はそのまま返す', () => {
  const pages = [{ id: 'p1', name: 'A', path: '/', blocks: [], seo }, { id: 'p2', name: 'B', path: '/b', blocks: [], seo }] as Page[];
  assert.equal(pagesFromBlocksJson({ v: 2, pages }, seo).length, 2);
});

test('空・壊れた保存形式でも空の1ページを返す（書き出しが落ちない）', () => {
  assert.equal(pagesFromBlocksJson(null, seo).length, 1);
  assert.equal(pagesFromBlocksJson({ v: 2, pages: [] } as unknown as { v: number; pages: Page[] }, seo)[0].blocks.length, 0);
});

test('書き出すHTMLからは、LARU HP側へ繋ぐ埋め込みを外す', () => {
  const settings = { larubot: true, laruseo: true, gaTrackingId: 'G-XXX' } as unknown as SiteSettings;
  const out = portableSettings(settings);
  assert.equal(out.larubot, false);
  assert.equal(out.laruseo, false);
  // お客さま自身の計測IDは残す
  assert.equal(out.gaTrackingId, 'G-XXX');
  // 元の設定は壊さない
  assert.equal(settings.larubot, true);
});

test('日本語の屋号でも壊れないファイル名を作る', () => {
  const n = exportFileName('結い庵', new Date('2026-09-16T00:00:00Z'));
  assert.equal(n.ascii, 'laruHP_site_2026-09-16.html');
  assert.equal(n.utf8, '結い庵_2026-09-16.html');
  assert.equal(exportFileName('Yui An', new Date('2026-09-16T00:00:00Z')).ascii, 'laruHP_Yui_An_2026-09-16.html');
  assert.ok(!exportFileName('a/b:c', new Date('2026-09-16T00:00:00Z')).ascii.includes('/'));
});

test('書き出しの入口が存在し、本人のサイトだけを返す', () => {
  const route = code('app/api/sites/[id]/export-html/route.ts');
  assert.match(route, /auth\.getUser\(\)/);
  assert.match(route, /\.eq\('user_id', user\.id\)/, '他人のサイトを書き出せてはいけない');
  assert.match(route, /Content-Disposition/);
  assert.match(route, /portableSettings/);
  // 契約状態で止めない。解約後も自分の文章を取り出せること。
  assert.doesNotMatch(route, /hasServiceAccess|subscription_required/);
});

test('公開と書き出しは同じ読み方を通る', () => {
  const publish = code('app/api/sites/[id]/publish/route.ts');
  assert.match(publish, /pagesFromBlocksJson/, '保存形式の読み分けが2か所に分かれると必ずずれる');
});

test('記事に書いた「HTMLで書き出せる」に、実際の画面がある', () => {
  const article = code('app/laruHP/articles/articles-data.ts');
  assert.match(article, /HTMLファイルとして書き出せます/);
  const settings = code('app/laruHP/settings/page.tsx');
  assert.match(settings, /export-html/, '記事の約束に対応する導線が設定画面にない');
  assert.match(settings, /ページをダウンロード \(HTML\)/);
});
