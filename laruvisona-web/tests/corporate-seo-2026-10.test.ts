import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { companyShareMeta } from '../lib/company-og';

/**
 * Corporate SEO 2.0（2026-10-06・docs/growth/2026-10-06-organic-growth-baseline.md の 7 節）で決めたことを固定する。
 */
const read = (p: string) => readFileSync(p, 'utf8');

test('共有の表示：ページごとの og:url・題・説明・画像。ルートの既定は og:url を持たない', () => {
  const m = companyShareMeta('/works', '開発実績 | 株式会社LaruVisona', '説明');
  const og = m.openGraph as { url: string; title: string; images: { url: string }[] };
  assert.equal(og.url, 'https://laruvisona.jp/works');
  assert.equal(og.title, '開発実績 | 株式会社LaruVisona');
  assert.equal(og.images[0].url, 'https://laruvisona.jp/opengraph-image');
  assert.equal((companyShareMeta('/', 't', 'd').openGraph as { url: string }).url, 'https://laruvisona.jp');
  for (const [file, path] of [['app/local/page.tsx', '/local'], ['app/works/page.tsx', '/works'], ['app/trouble/page.tsx', '/trouble'], ['app/contact/page.tsx', '/contact'], ['app/terms/page.tsx', '/terms'], ['app/privacy/page.tsx', '/privacy']]) {
    assert.ok(read(file).includes(`...companyShareMeta('${path}', `), `${file} に共有の表示が無い`);
  }
  const root = read('app/layout.tsx');
  const rootOg = root.slice(root.indexOf('openGraph: {'), root.indexOf('},', root.indexOf('openGraph: {')));
  assert.ok(!/\burl: 'https:\/\/laruvisona\.jp'/.test(rootOg), 'ルートの既定が og:url を持っている');
});

test('/services：最初の画面で頼める仕事が分かる（一覧と同じデータ）。実績・対応地域へ文脈リンク。ブランドの一文は変えない', () => {
  const s = read('app/services/page.tsx');
  assert.match(s, /aria-label="お受けしている仕事"[\s\S]{0,300}SERVICES\.map\(s => \(/);
  assert.match(s, /<Link href="\/works"[^>]*>開発実績<\/Link>/);
  assert.match(s, /<Link href="\/local"[^>]*>直接お伺いします<\/Link>/);
  assert.match(s, /つくって、売って、<span[^>]*>運用している。<\/span>/);
  assert.match(s, /images: \['https:\/\/laruvisona\.jp\/opengraph-image'\]/);
  // 実態以上に見せない：狙わない語を題・説明・最初の画面に入れていない
  const head = s.slice(0, s.indexOf('const SERVICES'));
  for (const w of ['AI開発会社', 'DX支援', 'AI導入支援', 'システム開発会社']) assert.ok(!head.includes(w), w);
});

test('会社情報は実在の値だけ（公式電話・所在地は正本から）', () => {
  const ld = read('lib/organization-ld.ts');
  assert.match(ld, /南常盤台1丁目11-6-101号室/);
  assert.match(read('lib/company-contact.ts'), /050-1792-3437/);
  for (const w of ['受賞', '導入社数', '導入実績No', '満足度']) {
    for (const f of ['app/services/page.tsx', 'app/local/page.tsx', 'app/works/page.tsx']) assert.ok(!read(f).includes(w), `${f}: ${w}`);
  }
});
