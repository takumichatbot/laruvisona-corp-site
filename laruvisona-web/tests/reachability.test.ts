import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { LARUHP_PUBLIC_PATHS, LARUHP_VS_SLUGS, laruHpSitemapXml, internalLaruHpPath } from '../lib/laruhp-public';
import { ARTICLES } from '../app/laruHP/articles/articles-data';
import { INDUSTRIES } from '../lib/laruhp-facts';
import { TROUBLES } from '../lib/trouble-data';

const code = (p: string) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');

/**
 * 「書いてあるのに、誰も辿り着けない」を防ぐ。
 * 2026-09-17 の点検で、比較ページ4本が noindex かつ sitemap 外かつ laruhp.com では404、
 * 記事11本と業種15本のあいだにリンクが1本も無い、という状態が見つかった。
 */

test('比較ページが、案内サイトから配信されて索引される', () => {
  for (const slug of LARUHP_VS_SLUGS) {
    assert.ok(LARUHP_PUBLIC_PATHS.includes(`/vs/${slug}`), `/vs/${slug} が公開パスに無い（laruhp.comでは404になる）`);
    assert.equal(internalLaruHpPath(`/vs/${slug}`), `/laruHP/vs/${slug}`);
    assert.ok(laruHpSitemapXml().includes(`https://laruhp.com/vs/${slug}`), 'sitemapに無い');
  }
  const page = code('app/laruHP/vs/[competitor]/page.tsx');
  assert.match(page, /robots: \{ index: true, follow: true \}/);
});

test('比較ページは、他社の機能や金額をこちらから断定しない', () => {
  const page = code('app/laruHP/vs/[competitor]/page.tsx');
  // 出典も日付も無い「◯◯にはこれが無い」は、比較広告として持たない
  const forbidden = ['AI機能が弱い', 'SEO機能なし', '日本語サポート弱い', 'デザインが古め', 'チャットボット非対応'];
  for (const word of forbidden) {
    assert.ok(!page.includes(word), `他社の欠点を断定している: ${word}`);
  }
  assert.match(page, /officialUrl/, '相手の最新は相手の公式ページで確かめてもらう');
});

test('sitemapに更新日が入っている', () => {
  const xml = laruHpSitemapXml('2026-09-17');
  assert.match(xml, /<lastmod>2026-09-17<\/lastmod>/);
});

test('記事と業種ページが、互いにつながっている', () => {
  const industryIds = new Set<string>(INDUSTRIES.map(i => i.id));
  let linked = 0;
  for (const article of ARTICLES) {
    for (const id of article.relatedIndustries ?? []) {
      assert.ok(industryIds.has(id), `${article.slug} の関連業種 ${id} が業種一覧に無い`);
      linked++;
    }
  }
  assert.ok(linked >= ARTICLES.length, 'ほとんどの記事に関連業種が付いていない');

  // どの業種ページからも、少なくとも1本の記事へ行けること
  for (const industry of INDUSTRIES) {
    const found = ARTICLES.some(a => a.relatedIndustries?.includes(industry.id));
    assert.ok(found, `${industry.id} の業種ページから読み物へ行けない`);
  }

  assert.match(code('app/laruHP/articles/[slug]/page.tsx'), /relatedIndustries/);
  assert.match(code('app/laruHP/[industry]/page.tsx'), /relatedArticles/);
});

test('読み物の出口が、申し込みだけになっていない', () => {
  for (const path of [
    'app/laruHP/articles/[slug]/page.tsx',
    'app/laruHP/[industry]/page.tsx',
    'app/laruHP/vs/[competitor]/page.tsx',
  ]) {
    const src = code(path);
    assert.match(src, /laruhp\.com\/contact/, `${path}: まだ決めていない人の行き先（相談）が無い`);
  }
});

test('困りごとページが、後半だけ行き止まりにならない', () => {
  const src = code('app/trouble/[slug]/page.tsx');
  // 先頭から3本を出すと、4本目以降にリンクが集まらない
  assert.doesNotMatch(src, /TROUBLES\.filter\(o => o\.slug !== t\.slug\)\.slice\(0, 3\)/);
  assert.match(src, /TROUBLES\[\(here \+ n\) % TROUBLES\.length\]/);
  assert.ok(TROUBLES.length > 3);
});

test('会社サイトの下層ページから、ほかのページへ行ける', () => {
  for (const path of [
    'app/services/page.tsx',
    'app/trouble/page.tsx',
    'app/trouble/[slug]/page.tsx',
    'app/local/page.tsx',
    'app/works/page.tsx',
    'app/works/[slug]/page.tsx',
  ]) {
    assert.match(code(path), /CompanyFooter/, `${path} に共通のフッターが無い`);
  }
});

test('問い合わせの受け口を1つにしない', () => {
  for (const path of ['app/contact/page.tsx', 'app/services/page.tsx']) {
    assert.match(code(path), /mailto:info@laruvisona\.jp/, `${path}: フォームが出ないときの宛先が無い`);
  }
});

test('中身が空のページを、sitemapに載せない', () => {
  const sitemap = code('app/sitemap.ts');
  // /blog は記事本体を外部（larubot.tokyo）が描くため、こちらのHTMLには本文が無い
  assert.doesNotMatch(sitemap, /\$\{base\}\/blog`/, '本文の無いページを「毎週更新」と宣言しない');
});

test('画面に出しているFAQを、構造化データでも同じ内容で出す', () => {
  const lp = code('app/laruHP/page.tsx');
  assert.match(lp, /FAQPage/);
  assert.match(lp, /\[\.\.\.HOW_FAQ, \.\.\.FACT_FAQ\.slice\(0, 3\)\]\.map\(f => \(\{/, '画面と別の配列からFAQを作ると、いつかズレる');
  const services = code('app/services/page.tsx');
  assert.match(services, /SERVICE_FAQ/);
  assert.match(services, /FAQPage/);
});
