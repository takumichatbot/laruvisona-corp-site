import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LARUHP_PUBLIC_PATHS } from '../lib/laruhp-public.ts';

const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// LARU HP の公開ページ（トップは自前の大きなフッターを持つので除く）
const PAGES = [
  'app/laruHP/[industry]/page.tsx',
  'app/laruHP/plans/page.tsx',
  'app/laruHP/domains/page.tsx',
  'app/laruHP/contact/page.tsx',
  'app/laruHP/articles/page.tsx',
  'app/laruHP/articles/[slug]/page.tsx',
  'app/laruHP/terms/page.tsx',
  'app/laruHP/privacy/page.tsx',
  'app/laruHP/tokusho/page.tsx',
];

test('公開ページはすべて共通フッターを使う', () => {
  // 以前は、まともなフッターがあるのはトップ1ページだけだった。
  for (const p of PAGES) {
    assert.match(src(p), /<PublicFooter/, p);
    assert.match(src(p), /components\/laruhp\/PublicFooter/, p);
  }
});

test('申し込みの手前から、規約・特商法・運営会社へ行ける', () => {
  const footer = src('components/laruhp/PublicFooter.tsx');
  for (const href of [
    'https://laruhp.com/terms',
    'https://laruhp.com/privacy',
    'https://laruhp.com/tokusho',
    'https://laruvisona.jp/',
  ]) {
    assert.ok(footer.includes(href), `フッターに ${href} が無い`);
  }
});

test('業種ページは、フッターから全部たどれる', () => {
  // 内部リンクの無いページには、検索側の評価も伝わらない。
  const footer = src('components/laruhp/PublicFooter.tsx');
  assert.match(footer, /LARUHP_INDUSTRIES\.map/);
  assert.match(footer, /https:\/\/laruhp\.com\/\$\{id\}/);
});

test('業種の表示名に抜けがない', async () => {
  const { LARUHP_INDUSTRIES } = await import('../lib/laruhp-public.ts');
  const footer = src('components/laruhp/PublicFooter.tsx');
  const labels = footer.match(/const INDUSTRY_LABEL[\s\S]*?\};/)![0];
  for (const id of LARUHP_INDUSTRIES) {
    assert.match(labels, new RegExp(`${id}:`), `${id} の表示名が無い`);
  }
});

test('公開パスの一覧と、フッターの案内が食い違っていない', () => {
  const footer = src('components/laruhp/PublicFooter.tsx');
  for (const path of ['/plans', '/domains', '/contact', '/articles', '/terms', '/privacy', '/tokusho']) {
    assert.ok(LARUHP_PUBLIC_PATHS.includes(path), `${path} が公開パスに無い`);
    assert.ok(footer.includes(`https://laruhp.com${path}`), `${path} がフッターに無い`);
  }
});
