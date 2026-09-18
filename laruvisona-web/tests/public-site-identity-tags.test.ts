import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripDuplicateHeadMeta } from '../lib/published-html';
import { sitemapUrlForSlug, SITEMAP_SITE_LIMIT } from '../lib/published-sites-index';

/**
 * 「同じページが、2つの身元を名乗る」件。
 *
 * published_html は1枚で完結する文書なので <head> に og: や canonical を持つ。
 * それを配信ページの <div> に丸ごと入れているため、配信ページ自身が
 * <head> に出しているものと二重になっていた。
 *
 * 2026-09-18 に本番（テストECショップ）で確かめた実際の姿:
 *   og:image が2つ。head は自動生成のカード、body は焼き込みの別画像。
 *
 * 見た目には何も出ないので、誰にも知らされない。
 */

const DOC = [
  '<!DOCTYPE html>',
  '<html lang="ja">',
  '<head>',
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1">',
  '<title>テストECショップ｜最短翌日</title>',
  '<meta name="description" content="焼き込みの説明">',
  '<meta name="robots" content="index,follow">',
  '<meta property="og:title" content="焼き込みの題">',
  '<meta property="og:image" content="https://images.example.com/old.jpg">',
  '<meta name="twitter:card" content="summary_large_image">',
  '<meta name="twitter:image" content="https://images.example.com/old.jpg">',
  '<link rel="canonical" href="https://laruvisona.jp/hp/abc">',
  '<style>body{color:#111}</style>',
  '<script>window.__X=1;</script>',
  '</head>',
  '<body>',
  '<h1>欲しいが、すぐ届く。</h1>',
  '</body>',
  '</html>',
].join('\n');

test('配信時、身元を名乗るタグは1組だけになる', () => {
  const out = stripDuplicateHeadMeta(DOC);
  for (const gone of ['og:title', 'og:image', 'twitter:card', 'twitter:image',
                      'rel="canonical"', 'name="description"', 'name="robots"', '<title>']) {
    assert.ok(!out.includes(gone), `${gone} が残っている`);
  }
});

test('見た目と動きを決めるものは落とさない', () => {
  const out = stripDuplicateHeadMeta(DOC);
  assert.ok(out.includes('<style>body{color:#111}</style>'), 'style が消えた');
  assert.ok(out.includes('window.__X=1'), 'script が消えた');
  assert.ok(out.includes('charset="utf-8"'), 'charset が消えた');
  assert.ok(out.includes('<h1>欲しいが、すぐ届く。</h1>'), '本文が消えた');
});

/*
  ⚠️ この検査の材料は、いまの書き出しが作らない形である。
     本文の「<」は書き出しの時点で &lt; になるので、素のタグは現れない。
     それでも範囲を切っておく理由は、本文に素のタグが現れる経路が
     **将来できたときに、本文が黙って消える**からである
     （顧客の customCss、本文の <script> の中の文字列、翻訳の当てはめなど）。
     材料が作り物であることを承知で、切ってあること自体を固定する。
*/
test('<body> より後ろには触らない', () => {
  const withRawTag = DOC.replace(
    '<h1>欲しいが、すぐ届く。</h1>',
    '<h1>設置の説明</h1><script>el.innerHTML=\'<meta property="og:image" content="x">\';</script>',
  );
  const out = stripDuplicateHeadMeta(withRawTag);
  assert.ok(out.includes('el.innerHTML='), '本文の script ごと消えた');
  assert.ok(out.includes('<meta property="og:image" content="x">'),
    '本文の中の文字列まで落としている');
  // head 側の焼き込みは、ちゃんと消えていること
  assert.ok(!out.includes('https://images.example.com/old.jpg'), 'head 側が残っている');
});

test('<body> が無い断片でも落ちない', () => {
  assert.equal(stripDuplicateHeadMeta(''), '');
  assert.ok(!stripDuplicateHeadMeta('<meta property="og:image" content="x">').includes('og:image'));
  assert.equal(stripDuplicateHeadMeta('<p>ただの文</p>'), '<p>ただの文</p>');
});

test('配信ページが、実際にこれを通してから差し込んでいる', () => {
  const page = readFileSync('app/hp/[slug]/page.tsx', 'utf8');
  assert.match(page, /^\s*const deduped = stripDuplicateHeadMeta\(withoutBakedEmbeds\);$/m,
    '配信ページで stripDuplicateHeadMeta を通していない');
  assert.match(page, /const eagerHtml = deduped\.replace\(/,
    '差し込む値が、通したあとのものになっていない');
});

/**
 * sitemap の件。
 * 公開しても、検索側から辿る道がどこにも無かった。
 */

test('日本語の slug は百分率記法にする', () => {
  const u = sitemapUrlForSlug('https://laruvisona.jp', 'のぞみ整体院-mtxas3cy');
  assert.ok(!/[^\x20-\x7e]/.test(u), `生の日本語が残っている: ${u}`);
  assert.ok(u.startsWith('https://laruvisona.jp/hp/'));
  assert.equal(decodeURIComponent(u), 'https://laruvisona.jp/hp/のぞみ整体院-mtxas3cy');
});

test('末尾のスラッシュを足しても二重にならない', () => {
  assert.equal(sitemapUrlForSlug('https://laruvisona.jp/', 'abc'), 'https://laruvisona.jp/hp/abc');
});

test('会社の sitemap が、公開サイトを載せる作りになっている', () => {
  const src = readFileSync('app/sitemap.ts', 'utf8');
  assert.match(src, /listPublishedPathSites\(\)/, '公開サイトを読んでいない');
  assert.match(src, /sitemapUrlForSlug\(base, site\.slug\)/, 'URLの作り方が共通のものでない');
  assert.match(src, /^export const revalidate = \d+;$/m,
    '作り置きのままだと、あとから公開した人が載らない');
});

test('取りに行く件数に上限がある', () => {
  assert.ok(SITEMAP_SITE_LIMIT > 0 && SITEMAP_SITE_LIMIT <= 50000);
  const src = readFileSync('lib/published-sites-index.ts', 'utf8');
  assert.match(src, /\.limit\(SITEMAP_SITE_LIMIT\)/, '上限をかけずに全件読んでいる');
});

test('独自ドメインと noIndex は載せない', () => {
  const src = readFileSync('lib/published-sites-index.ts', 'utf8');
  assert.match(src, /^\s*if \(\(row\.custom_domain \|\| ''\)\.trim\(\)\) continue;$/m,
    '独自ドメインのサイトを除いていない');
  assert.match(src, /^\s*if \(\(row\.settings_json \|\| \{\}\)\.noIndex === true\) continue;$/m,
    'noIndex を選んだ人を除いていない');
  assert.match(src, /\.eq\('published', true\)/, '未公開まで載せている');
});

test('取得に失敗しても、会社の sitemap ごと落とさない', () => {
  const src = readFileSync('lib/published-sites-index.ts', 'utf8');
  assert.match(src, /\} catch \{\s*\n\s*return \[\];\s*\n\s*\}/, '例外をそのまま投げている');
  assert.match(src, /if \(error \|\| !data\) return \[\];/, 'PostgREST の error を見ていない');
});

/**
 * 計測タグの二重化（2026-09-19）。
 * 焼き込みの GA / Clarity と、配信ページが出す GA / Clarity が両方動き、
 * ページビューが2倍に数えられていた。配信時は焼き込みを落とす。
 */
const GA_DOC = [
  '<!DOCTYPE html><html lang="ja"><head>',
  '<meta charset="utf-8">',
  '<script async src="https://www.googletagmanager.com/gtag/js?id=G-OLDOLD"></script>',
  "<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config',\"G-OLDOLD\");</script>",
  '<script type="text/javascript">(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window,document,"clarity","script","abc123");</script>',
  '<style>body{color:#111}</style>',
  '</head><body>',
  '<h1>店</h1>',
  "<script>(function(){if(typeof gtag!=='function')return;document.querySelectorAll('.lhp-cta a').forEach(function(el){el.addEventListener('click',function(){gtag('event','cta_click',{});});});})();</script>",
  '</body></html>',
].join('\n');

test('配信時、焼き込みの GA 読み込み・config・Clarity を落とす', () => {
  const out = stripDuplicateHeadMeta(GA_DOC);
  assert.ok(!out.includes('googletagmanager.com/gtag/js'), 'gtag の読み込みが残っている');
  assert.ok(!out.includes("gtag('config'"), "gtag('config') が残っている");
  assert.ok(!out.includes('clarity.ms/tag'), 'Clarity が残っている');
  assert.ok(!out.includes('G-OLDOLD'), '古い計測IDが残っている');
});

test('本文側の gtag(\'event\') は落とさない（フォーム・CTA・スクロールの計測）', () => {
  const out = stripDuplicateHeadMeta(GA_DOC);
  assert.ok(out.includes("gtag('event','cta_click'"), '本文のイベント計測まで消えた');
  assert.ok(out.includes('<style>body{color:#111}</style>'), 'style が消えた');
  assert.ok(out.includes('<h1>店</h1>'), '本文が消えた');
});

test('配信ページ側が計測タグを出している（落とした分の受け皿がある）', () => {
  const page = readFileSync('app/hp/[slug]/page.tsx', 'utf8');
  assert.match(page, /googletagmanager\.com\/gtag\/js/, '配信ページが gtag を出していない');
  assert.match(page, /gtag\('config',/, "配信ページが gtag('config') を出していない");
  assert.match(page, /clarity\.ms\/tag/, '配信ページが Clarity を出していない');
});
