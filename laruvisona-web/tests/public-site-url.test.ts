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
const { publicBase, siteUrl, sitePath } = await import('../lib/public-site-url.ts');

const A = { slug: 'salon-a', custom_domain: 'salon-a.example' };
const NoDomain = { slug: 'plain', custom_domain: null };

test('開かれたホストに合わせて正規URLを決める', () => {
  assert.equal(publicBase(A, 'salon-a.example'), 'https://salon-a.example');
  assert.equal(publicBase(A, 'www.salon-a.example'), 'https://salon-a.example');
  assert.equal(publicBase(A, 'salon-a.laruvisona.jp'), 'https://salon-a.laruvisona.jp');
  // 独自ドメインを持つサイトは、会社ホストで開かれても独自ドメインが正
  assert.equal(publicBase(A, 'laruvisona.jp'), 'https://salon-a.example');
  // 独自ドメインが無ければパス形式
  assert.equal(publicBase(NoDomain, 'laruvisona.jp'), 'https://laruvisona.jp/hp/plain');
  assert.equal(publicBase(NoDomain, 'plain.laruvisona.jp'), 'https://plain.laruvisona.jp');
});

test('ポート付きのHostでも判定できる', () => {
  assert.equal(publicBase(A, 'salon-a.example:443'), 'https://salon-a.example');
});

test('サイト内リンクは、その形に合ったパスになる', () => {
  // 独自ドメイン・サブドメイン形式では /post/x
  assert.equal(sitePath(A, 'salon-a.example', 'post/x'), '/post/x');
  assert.equal(sitePath(NoDomain, 'plain.laruvisona.jp', 'post/x'), '/post/x');
  // パス形式では /hp/<slug>/post/x
  assert.equal(sitePath(NoDomain, 'laruvisona.jp', 'post/x'), '/hp/plain/post/x');
  assert.equal(sitePath(NoDomain, 'laruvisona.jp'), '/hp/plain');
});

test('siteUrl はスラッシュを重ねない', () => {
  assert.equal(siteUrl('https://x.example', 'shop'), 'https://x.example/shop');
  assert.equal(siteUrl('https://x.example/', '/shop'), 'https://x.example/shop');
  assert.equal(siteUrl('https://x.example', ''), 'https://x.example');
});

// ── 実装の構造として保証したいこと ──

const root = path.resolve(import.meta.dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

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

test('ショップと sitemap は開かれたホストの正規URLを使う', () => {
  const shop = read('app/hp/[slug]/shop/page.tsx');
  assert.match(shop, /publicBase\(/);
  assert.equal(/const shopUrl = `\$\{appUrl\}/.test(shop), false, '会社ホストのURLを作っている');

  const sitemap = read('app/hp/[slug]/sitemap.xml/route.ts');
  assert.match(sitemap, /publicBase\(/);
  const robots = read('app/hp/[slug]/robots.txt/route.ts');
  assert.match(robots, /publicBase\(/);
});

test('決済の戻り先はショップのURLをそのまま使う', () => {
  const client = read('app/hp/[slug]/shop/ShopClient.tsx');
  assert.match(client, /successUrl: `\$\{shopUrl\}\?payment=success`/);
  assert.match(client, /cancelUrl: shopUrl/);
});
