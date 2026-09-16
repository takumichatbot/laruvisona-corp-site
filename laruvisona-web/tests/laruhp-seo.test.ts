import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ARTICLES } from '../app/laruHP/articles/articles-data';
import { LARUHP_ARTICLE_SLUGS, LARUHP_INDUSTRIES, LARUHP_PUBLIC_PATHS } from '../lib/laruhp-public';

const read = (path: string) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('公開記事の一覧とサイトマップを同じ集合に保つ', () => {
  assert.deepEqual(ARTICLES.map(article => article.slug), [...LARUHP_ARTICLE_SLUGS]);
  assert.equal(new Set(LARUHP_PUBLIC_PATHS).size, LARUHP_PUBLIC_PATHS.length);
  for (const id of LARUHP_INDUSTRIES) assert.ok(LARUHP_PUBLIC_PATHS.includes(`/${id}`));
});

test('記事と業種ページは専用ドメインの自分自身をcanonicalにする', () => {
  const article = read('app/laruHP/articles/[slug]/page.tsx');
  assert.match(article, /alternates: \{ canonical: `https:\/\/laruhp\.com\/articles\/\$\{article\.slug\}` \}/);
  assert.match(article, /url: `https:\/\/laruhp\.com\/articles\/\$\{article\.slug\}`/);
  const industry = read('app/laruHP/[industry]/page.tsx');
  assert.match(industry, /alternates: \{ canonical: `https:\/\/laruhp\.com\/\$\{industry\}` \}/);
  assert.match(industry, /url: `https:\/\/laruhp\.com\/\$\{industry\}`/);
});

test('会社サイトのsitemapに別originのLARU HPページを混ぜない', () => {
  const sitemap = read('app/sitemap.ts');
  assert.doesNotMatch(sitemap, /laruhp\.com|\/laruHP\//);
  for (const path of ['articles/page.tsx', 'contact/page.tsx', 'plans/layout.tsx', 'privacy/page.tsx', 'terms/page.tsx', 'tokusho/page.tsx']) {
    assert.match(read(`app/laruHP/${path}`), /https:\/\/laruhp\.com/);
  }
});

test('OGP画像は会社サイトではなくLARU HP専用ドメインを使う', () => {
  const layout = read('app/laruHP/layout.tsx');
  const page = read('app/laruHP/page.tsx');
  assert.match(layout, /https:\/\/laruhp\.com\/opengraph-image/);
  assert.match(page, /https:\/\/laruhp\.com\/opengraph-image/);
  assert.doesNotMatch(`${layout}\n${page}`, /laruvisona\.jp\/laruHP\/opengraph-image/);
});

test('IndexNow は公開鍵と同一ホストのサイトマップだけを送る', () => {
  const key = read('public/indexnow-key.txt').trim();
  const submitter = read('scripts/submit-indexnow.mjs');
  assert.match(key, /^[A-Za-z0-9-]{8,128}$/);
  assert.match(submitter, /https:\/\/laruhp\.com/);
  assert.match(submitter, /new URL\(url\)\.origin !== siteOrigin/);
  assert.match(submitter, /The deployed IndexNow key does not match/);
  assert.doesNotMatch(submitter, /console\.log\([^)]*key/);
});

test('検索へ出す記事と業種ページに未検証の成果断定や絵文字を残さない', () => {
  const articles = read('app/laruHP/articles/articles-data.ts');
  const industry = read('app/laruHP/[industry]/page.tsx');
  for (const source of [articles, industry]) {
    assert.doesNotMatch(source, /問い合わせ率|問い合わせ数が2倍|消費者の87%|上位表示を狙|最強|手数料ゼロ|5分で完成/);
  }
  assert.doesNotMatch(industry, /[🍽✂️💆⚖️🏗🏢🛍💪🏨📚💍🐾🦷📷📊🤖📩🌐🎉]/u);
  assert.match(articles, /author: string/);
  assert.match(articles, /sources: ArticleSource\[\]/);
});

test('顧客サイトのrobotsとsitemapを仮slugでビルド時生成しない', () => {
  for (const path of [
    'app/hp/[slug]/robots.txt/route.ts',
    'app/hp/[slug]/sitemap.xml/route.ts',
    'app/hp/by-domain/[domain]/robots.txt/route.ts',
    'app/hp/by-domain/[domain]/sitemap.xml/route.ts',
  ]) {
    assert.match(read(path), /export const dynamic = 'force-dynamic'/);
  }
});

test('管理画面は既定でnoindexにし、公開ページだけ索引を明示する', () => {
  const layout = read('app/laruHP/layout.tsx');
  assert.match(layout, /robots: \{ index: false, follow: false/);
  for (const path of [
    'page.tsx', '[industry]/page.tsx', 'articles/page.tsx', 'articles/[slug]/page.tsx',
    'plans/layout.tsx', 'domains/page.tsx', 'contact/page.tsx', 'privacy/page.tsx',
    'terms/page.tsx', 'tokusho/page.tsx',
    // 比較ページは書いてあるのにnoindexで、laruhp.comからは404だった（2026-09-17に公開）
    'vs/[competitor]/page.tsx',
  ]) {
    assert.match(read(`app/laruHP/${path}`), /robots: \{ index: true, follow: true \}/, path);
  }
});

test('制作画面と既定テンプレートに絵文字を使わない', () => {
  const emoji = /[\u{1F000}-\u{1FAFF}]/u;
  for (const path of ['app/laruHP/builder/page.tsx', 'app/laruHP/agency/page.tsx', 'lib/templates.ts']) {
    assert.doesNotMatch(read(path), emoji, path);
  }
});
