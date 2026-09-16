import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WORKS } from '../lib/works-data.ts';

test('実績ページが sitemap に入っている', () => {
  const sitemap = readFileSync(new URL('../app/sitemap.ts', import.meta.url), 'utf8');
  assert.match(sitemap, /\$\{base\}\/works`/);
  assert.match(sitemap, /WORKS\.map/);
});

test('実績ページへの入口が、サイトの中にある', () => {
  // どこからもリンクされていないページは、書いていないのと同じ。
  const top = readFileSync(new URL('../components/immersive/CompanyExperience.tsx', import.meta.url), 'utf8');
  assert.match(top, /href="\/works"/);
});

test('一覧は実体であって、存在しない目印への転送ではない', () => {
  const index = readFileSync(new URL('../app/works/page.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(index, /redirect\('\/#works'\)/);
  assert.match(index, /export const metadata/);
  // 詳細への戻り先も、実在するページ
  const detail = readFileSync(new URL('../app/works/[slug]/page.tsx', import.meta.url), 'utf8');
  assert.match(detail, /href="\/works"/);
  assert.doesNotMatch(detail, /href="\/#works"/);
});

test('実績に、空のスクリーンショット枠を出さない', () => {
  const detail = readFileSync(new URL('../app/works/[slug]/page.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(detail, /スクリーンショット \{i \+ 1\}/);
  assert.doesNotMatch(detail, /推奨 \{work\.screenshots/);
  for (const w of WORKS) {
    assert.ok(w.shots.length >= 1, `${w.slug}: 画面が1枚も無い`);
    for (const s of w.shots) {
      assert.match(s.src, /^\/[\w/-]+\.(jpg|png|webp|avif)$/, `${w.slug}: ${s.src}`);
      assert.ok(s.alt.length > 0 && s.caption.length > 0, `${w.slug}: 説明が空`);
    }
  }
});

test('載せる画面の画像が、実際に置いてある', async () => {
  const { existsSync } = await import('node:fs');
  for (const w of WORKS) {
    for (const s of w.shots) {
      const file = new URL(`../public${s.src}`, import.meta.url);
      assert.ok(existsSync(file), `${w.slug}: public${s.src} が無い`);
    }
  }
});
