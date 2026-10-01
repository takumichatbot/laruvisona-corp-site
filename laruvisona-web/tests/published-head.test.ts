// 公開ページの head・構造化データ・OGカードを「公開した時点の内容」から決めること
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { exportToHTML } from '../lib/html-export';
import { bodyFingerprint, isAutoOgImage, readPublishedHead, readPublishedMeta } from '../lib/published-head';
import { resolvePublishedPresentation, snapshotMatchesPublished } from '../lib/published-presentation';
import type { Block, Page, SEOSettings, SiteSettings } from '../types/laruHP';

const pages = (heading: string): Page[] => [{ id: 'p', name: 'トップ', path: '/', seo: {} as SEOSettings, blocks: [
  { id: 'hero-1', type: 'hero', data: { heading, ctaText: '相談', ctaLink: '#c' } },
  { id: 'text-1', type: 'paragraph', data: { text: '本文' } },
] as Block[] }];
const seo = (k: string) => ({ title: `題名${k}`, description: `説明${k} "引用" <タグ> & 記号`, keywords: '', ogTitle: `OG題名${k}`, ogDescription: `OG説明${k}` }) as SEOSettings;
const settings = (k: string) => ({ designStyle: 'modern', businessInfo: { name: `事業者${k}`, phone: '03-0000-0000', ogImage: `https://img.example/${k}.png` } }) as unknown as SiteSettings;
const publish = (k: string, heading = `見出し${k}`) => exportToHTML(pages(heading), seo(k), settings(k), `サイト${k}`, { name: `サイト${k}`, siteId: 's1', slug: 'x' });
const doc = (k: string, heading = `見出し${k}`) => ({ v: 2, pages: pages(heading) });

test('公開HTMLの head から、公開時点の title・description・og・twitter を読む（エスケープを戻す）', () => {
  const h = readPublishedHead(publish('A'));
  assert.equal(h.title, '題名A');
  assert.equal(h.description, '説明A "引用" <タグ> & 記号');
  assert.equal(h.ogTitle, 'OG題名A'); assert.equal(h.ogDescription, 'OG説明A');
  assert.equal(h.ogImage, 'https://img.example/A.png');           // SEO設定画面のOG画像も公開時点の値として焼き込む
  assert.equal(h.twitterTitle, 'OG題名A');
  assert.deepEqual(h.meta, { siteName: 'サイトA', businessInfo: settings('A').businessInfo as unknown as Record<string, unknown> });
});

test('本文にある同じ形の文字列や、壊れた補足は拾わない。http(s) 以外の画像URLは捨てる', () => {
  const html = '<html><head><title>公開</title><meta property="og:image" content="javascript:alert(1)"></head><body><title>本文</title><meta name="description" content="本文の偽物"><!--lhpmeta:%%%--></body></html>';
  const h = readPublishedHead(html);
  assert.equal(h.title, '公開'); assert.equal(h.description, ''); assert.equal(h.ogImage, ''); assert.equal(h.meta, null);
  assert.equal(readPublishedMeta('<!--lhpmeta:eyJ2IjoyfQ==-->'), null);   // 版が違う補足は使わない
});

test('自動生成のOG画像（/api/og）は「自分で指定した画像」とみなさない', () => {
  assert.equal(isAutoOgImage('https://laruvisona.jp/api/og?title=a'), true);
  assert.equal(isAutoOgImage('https://img.example/a.png'), false);
});

test('補足のある公開HTML：下書きがBでも、名前・説明・事業者情報はA', () => {
  const p = resolvePublishedPresentation({ id: 's1', name: 'サイトB', published_html: publish('A'), blocks_json: doc('B'), seo_json: seo('B'), settings_json: settings('B') }, null);
  assert.equal(p.source, 'embedded');
  assert.equal(p.title, '題名A'); assert.equal(p.siteName, 'サイトA'); assert.equal((p.businessInfo as { name: string }).name, '事業者A');
  assert.equal(p.explicitOgImage, 'https://img.example/A.png');
  assert.doesNotMatch(JSON.stringify(p), /B/);
});

test('以前の公開HTML（補足なし）：版が無い・未公開の変更がある・中身が違うときは、下書きで補わない', () => {
  const old = publish('A').replace(/<!--lhpmeta:[^>]*-->/, '');
  const site = (k: string, extra = {}) => ({ id: 's1', name: 'サイトA', slug: 'x', published_html: old, blocks_json: doc(k), seo_json: seo(k), settings_json: settings(k), ...extra });
  const none = resolvePublishedPresentation(site('B'), null);
  assert.equal(none.source, 'published_head_only'); assert.equal(none.reason, 'no_snapshot');
  assert.deepEqual(none.businessInfo, {}); assert.equal(none.siteName, '題名A');
  assert.equal(resolvePublishedPresentation(site('B'), { blocks_json: doc('A'), seo_json: seo('A'), settings_json: settings('A') }).reason, 'unpublished_changes');
  // 部品IDも head も同じで、本文の文字だけ違う版
  const v2 = { blocks_json: doc('A', '見出しA2'), seo_json: seo('A'), settings_json: settings('A') };
  const r2 = resolvePublishedPresentation(site('A', { blocks_json: doc('A', '見出しA2') }), v2);
  assert.equal(r2.source, 'published_head_only'); assert.equal(r2.reason, 'content_mismatch');
  assert.deepEqual(snapshotMatchesPublished(site('A'), v2), { ok: false, reason: 'content_mismatch' });
  // 下書き＝版、かつ 中身が公開HTMLと一致 → 版の事業者情報を使う
  const ok = resolvePublishedPresentation(site('A'), { blocks_json: doc('A'), seo_json: seo('A'), settings_json: settings('A') });
  assert.equal(ok.source, 'verified_snapshot'); assert.equal((ok.businessInfo as { name: string }).name, '事業者A');
});

test('本文の指紋：部品IDが同じでも、文字・リンクが違えば別物', () => {
  assert.notEqual(bodyFingerprint(publish('A')), bodyFingerprint(publish('A', '見出しA2')));
  assert.equal(bodyFingerprint(publish('A')), bodyFingerprint(publish('A')));
});

test('公開ページと OG カードは、下書きの name・seo_json・settings_json を head に使わない', () => {
  const page = fs.readFileSync(new URL('../app/hp/[slug]/page.tsx', import.meta.url), 'utf8');
  const og = fs.readFileSync(new URL('../app/hp/[slug]/opengraph-image.tsx', import.meta.url), 'utf8');
  assert.match(page, /loadPublishedPresentation\(supabase, data\)/);
  assert.doesNotMatch(page, /seo\.title \|\| data\.name|seo\.ogTitle|buildJsonLd\(site\.name/);
  assert.match(og, /loadPublishedPresentation/);
  assert.doesNotMatch(og, /data\?\.name \|\| slug|seo\.description/);
});
