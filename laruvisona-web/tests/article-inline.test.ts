import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inlineMarkdown } from '../lib/article-inline.ts';
import { ARTICLES } from '../app/laruHP/articles/articles-data.ts';
import { ARTICLES_2026_09_19 } from '../app/laruHP/articles/articles-2026-09-19.ts';
import { LARUHP_PUBLIC_PATHS } from '../lib/laruhp-public.ts';

/*
  2026-09-19 まで、記事のリンクは HTML にならず、公開ページに
  `[料金プラン](https://laruhp.com/plans)` がそのまま出ていた。
*/

test('自社ページへのリンクが <a> になる', () => {
  const html = inlineMarkdown('申込みの前に[料金プラン](https://laruhp.com/plans)でご確認ください。');
  assert.match(html, /<a href="https:\/\/laruhp\.com\/plans"[^>]*>料金プラン<\/a>/);
  assert.ok(!html.includes(']('), '生のマークダウンが残っている');
});

test('相対パスは laruhp.com の絶対URLになる', () => {
  const html = inlineMarkdown('[写真の記事](/articles/hp-shashin-nai)を読む');
  assert.match(html, /href="https:\/\/laruhp\.com\/articles\/hp-shashin-nai"/);
});

test('自社以外へのリンクは、文字だけ残してリンクにしない', () => {
  const html = inlineMarkdown('[外部](https://example.com/x) と [偽装](https://laruhp.com.evil.example/)');
  assert.ok(!html.includes('<a '), `外部をリンクにした: ${html}`);
  assert.ok(html.includes('外部') && html.includes('偽装'));
});

test('太字・コードとリンクが同じ行で共存する', () => {
  const html = inlineMarkdown('**大事**：`code` と [料金](https://laruhp.com/plans)');
  assert.match(html, /<strong>大事<\/strong>/);
  assert.match(html, /<code[^>]*>code<\/code>/);
  assert.match(html, /<a href="https:\/\/laruhp\.com\/plans"/);
});

test('配信ページが、段落・箇条書き・表・引用のすべてで inlineMarkdown を通している', () => {
  const page = readFileSync('app/laruHP/articles/[slug]/page.tsx', 'utf8');
  assert.match(page, /import \{ inlineMarkdown \} from '@\/lib\/article-inline'/);
  // 以前の「太字だけ置き換える」書き方が残っていないこと
  assert.ok(!page.includes("item.replace(/\\*\\*(.+?)\\*\\*/g"), '箇条書きが太字しか処理していない');
  assert.ok(!page.includes("cell.replace(/\\*\\*(.+?)\\*\\*/g"), '表が太字しか処理していない');
  assert.match(page, /line\.startsWith\('> '\)/, '引用（> ）を扱っていない');
  assert.match(page, /<blockquote/);
});

test('記事本文のリンク先は、すべて公開しているページ', () => {
  const known = new Set(LARUHP_PUBLIC_PATHS);
  for (const a of ARTICLES) {
    for (const m of a.body.matchAll(/\]\(([^)\s]+)\)/g)) {
      const target = m[1];
      const path = target.startsWith('/') ? target : target.replace(/^https:\/\/laruhp\.com/, '');
      assert.ok(path.startsWith('/'), `${a.slug}: 自社以外へのリンク ${target}（出典は sources へ）`);
      assert.ok(known.has(path), `${a.slug}: 公開していないページへのリンク ${target}`);
    }
  }
});

test('2026-09-19 の10本が、業種ページと結ばれていて、断定的な売り文句を含まない', () => {
  assert.equal(ARTICLES_2026_09_19.length, 10);
  for (const a of ARTICLES_2026_09_19) {
    assert.ok((a.relatedIndustries ?? []).length >= 1, `${a.slug}: 関連業種が無い`);
    assert.equal(a.publishedAt, '2026-09-19');
    for (const banned of ['導入社数', '満足度', '順位を保証', '必ず上位', 'No.1です', '業界最安']) {
      assert.ok(!a.body.includes(banned), `${a.slug}: 裏の取れない主張 ${banned}`);
    }
    // 法律の話をする記事は、一次情報を出典に持つ
    if (/医療広告ガイドライン/.test(a.body)) {
      assert.ok(a.sources.some(s => s.url.startsWith('https://www.mhlw.go.jp/')), `${a.slug}: 厚労省の出典が無い`);
    }
  }
});
