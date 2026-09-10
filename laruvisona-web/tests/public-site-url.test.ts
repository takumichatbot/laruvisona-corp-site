// 顧客サイトの正規URLの決め方。
//
// 同じサイトが3つの形で開ける（パス形式・サブドメイン形式・独自ドメイン形式）。
// canonical・JSON-LD・sitemap・記事リンク・決済の戻り先が
// ばらばらの形を作ると、重複コンテンツと「別ホストへ戻される決済」になる。

import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

process.env.NEXT_PUBLIC_APP_URL = 'https://laruvisona.jp';
const { canonicalBase, siteUrl, siteLink, isHostForSite } = await import('../lib/public-site-url.ts');

const A = { slug: 'salon-a', custom_domain: 'salon-a.example' };
const NoDomain = { slug: 'plain', custom_domain: null };

test('正規URLは入口のホストに依存しない', () => {
  // 独自ドメインがあれば、どこから開かれてもそれが正規
  assert.equal(canonicalBase(A), 'https://salon-a.example');
  // 無ければパス形式（サブドメイン形式は正規URLにしない）
  assert.equal(canonicalBase(NoDomain), 'https://laruvisona.jp/hp/plain');
  assert.equal(canonicalBase({ slug: null, custom_domain: null }), 'https://laruvisona.jp');
});

test('サイト内リンクは正規URLへの絶対URL', () => {
  // 会社ホストで開いても「/」にならない（会社トップへ戻らない）
  assert.equal(siteLink(A), 'https://salon-a.example');
  assert.equal(siteLink(A, 'post/x'), 'https://salon-a.example/post/x');
  assert.equal(siteLink(NoDomain), 'https://laruvisona.jp/hp/plain');
  assert.equal(siteLink(NoDomain, 'post/x'), 'https://laruvisona.jp/hp/plain/post/x');
});

test('siteUrl はスラッシュを重ねない', () => {
  assert.equal(siteUrl('https://x.example', 'shop'), 'https://x.example/shop');
  assert.equal(siteUrl('https://x.example/', '/shop'), 'https://x.example/shop');
  assert.equal(siteUrl('https://x.example', ''), 'https://x.example');
});

test('そのホストでそのサイトを配信してよいかを判定する', () => {
  assert.equal(isHostForSite(A, 'salon-a.example'), true);
  assert.equal(isHostForSite(A, 'www.salon-a.example'), true);
  assert.equal(isHostForSite(A, 'salon-a.laruvisona.jp'), true);
  assert.equal(isHostForSite(A, 'laruvisona.jp'), true);        // パス形式
  assert.equal(isHostForSite(A, 'salon-a.example:443'), true);
  // 別サイトのホストからは配信しない（内部パス直指定の遮断）
  assert.equal(isHostForSite(A, 'bistro-b.example'), false);
  assert.equal(isHostForSite(A, 'site-b.laruvisona.jp'), false);
  assert.equal(isHostForSite(NoDomain, 'salon-a.example'), false);
});

// ── 実装の構造として保証したいこと ──

const root = path.resolve(import.meta.dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

test('戻るリンクは正規URLへの絶対URLにする', () => {
  const src = read('app/hp/[slug]/post/[postId]/page.tsx');
  assert.match(src, /const backHref = siteLink\(site\)/);
  assert.equal(/sitePath\(/.test(src), false, '相対パスに戻っている');
});

test('記事はURLが指すサイトに属するものだけを表示する', () => {
  const src = read('app/hp/[slug]/post/[postId]/page.tsx');
  // site_id 一致を必須にしている（記事IDだけで引かない）
  assert.match(src, /\.eq\('site_id', site\.id\)/);
  assert.match(src, /\.eq\('published', true\)/);
  assert.match(src, /if \(!data\) notFound\(\)/);
  // サイト自体も公開済みであること
  assert.match(src, /\.eq\('slug', slug\)[\s\S]{0,80}\.eq\('published', true\)/);
});

test('旧い記事URLは表示せず、そのサイトの正規URLへ転送する', () => {
  const src = read('app/hp/post/[postId]/page.tsx');
  assert.match(src, /permanentRedirect\(/);
  // 本文を描画しない（他サイトの記事を顧客ホストに出さない）
  assert.equal(/renderMarkdown/.test(src), false, '旧ルートがまだ本文を描画している');
});

test('by-domain のページを二重に持たない', () => {
  const src = read('app/hp/by-domain/[domain]/page.tsx');
  assert.equal(/PublishedSite/.test(src), false, 'ページの複製が残っている');
  assert.match(src, /permanentRedirect\(/);
});

test('ショップ・sitemap・robots は同じ正規URLの基点を使う', () => {
  const shop = read('app/hp/[slug]/shop/page.tsx');
  assert.match(shop, /canonicalBase\(/);
  assert.equal(/const shopUrl = `\$\{appUrl\}/.test(shop), false, '会社ホストのURLを作っている');
  // generateMetadata に canonical がある
  const meta = shop.slice(shop.indexOf('export async function generateMetadata'), shop.indexOf('interface Product'));
  assert.match(meta, /alternates: \{ canonical \}/, 'ショップに canonical が無い');

  const sitemap = read('app/hp/[slug]/sitemap.xml/route.ts');
  assert.match(sitemap, /canonicalBase\(/);
  const robots = read('app/hp/[slug]/robots.txt/route.ts');
  assert.match(robots, /canonicalBase\(/);
});

test('sitemap にそのサイトの公開記事だけを載せる', () => {
  const sitemap = read('app/hp/[slug]/sitemap.xml/route.ts');
  assert.match(sitemap, /from\('news_posts'\)/);
  assert.match(sitemap, /\.eq\('site_id', site\.id\)/, '別サイトの記事が混ざる');
  assert.match(sitemap, /\.eq\('published', true\)/, '非公開記事が混ざる');
  assert.match(sitemap, /\$\{loc\}\/post\/\$\{post\.id\}/);
});

test('表示側でもホストとサイトの対応を確認する', () => {
  for (const f of [
    'app/hp/[slug]/page.tsx',
    'app/hp/[slug]/shop/page.tsx',
    'app/hp/[slug]/post/[postId]/page.tsx',
  ]) {
    const src = read(f);
    assert.match(src, /isHostForSite\(/, `ホスト確認が無い: ${f}`);
    assert.match(src, /notFound\(\)/, `拒否していない: ${f}`);
  }
});

test('proxy は顧客ホストで内部パスを素通ししない', () => {
  const src = read('proxy.ts');
  const block = src.slice(src.indexOf('Custom domain routing'), src.indexOf('// Auth session handling'));
  assert.equal(/pathname\.startsWith\('\/hp'\)/.test(block), false, '/hp を除外している');
  assert.equal(/pathname\.startsWith\('\/laruHP'\)/.test(block), false, '/laruHP を除外している');
  // 割当キャッシュを持たない
  assert.equal(/domainSlugCache/.test(src), false, '割当キャッシュが残っている');
  assert.equal(/adminDomainCache/.test(src), false, '代理店ドメインのキャッシュが残っている');
});

test('決済の戻り先はショップのURLをそのまま使う', () => {
  const client = read('app/hp/[slug]/shop/ShopClient.tsx');
  assert.match(client, /successUrl: `\$\{shopUrl\}\?payment=success`/);
  assert.match(client, /cancelUrl: shopUrl/);
});
