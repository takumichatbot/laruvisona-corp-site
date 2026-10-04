import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chatPublicId, blogPublicId, withSeoArticleSlot, SEO_ARTICLE_TARGET } from '../lib/larubot-public-id.ts';

/* 2026-09-27 LARU HP × LARUbot × LARU SEO の設置を、結果で守る。 */

const ID = '3f2b8c1e-8d4a-4c1b-9a77-0c1d2e3f4a5b';

test('public_id: 正しい形だけを公開ページへ出す（手入力の欄の値も同じ規則）', () => {
  assert.equal(chatPublicId({ larubotPublicId: ` ${ID} ` }), ID);
  assert.equal(blogPublicId({ larubotPublicId: ID }), ID, 'SEOの欄が空ならチャットのIDを使う');
  for (const bad of ['"><script>alert(1)</script>', 'a b', 'x'.repeat(65), 'javascript:alert(1)']) {
    assert.equal(chatPublicId({ larubotPublicId: bad }), '', bad);
    assert.equal(blogPublicId({ laruseoPublicId: bad }), '', bad);
  }
  // 片方が壊れていれば、もう片方の正しい値を使う
  assert.equal(blogPublicId({ laruseoPublicId: 'bad id', larubotPublicId: ID }), ID);
});

test('記事一覧の置き場: フッターの直前に1つだけ。無ければ本文の最後', () => {
  const page = '<main><h1>店</h1></main><footer>©</footer>';
  const out = withSeoArticleSlot(page);
  assert.equal((out.match(/id="laru-seo-articles"/g) || []).length, 1);
  assert.ok(out.indexOf('id="laru-seo-articles"') < out.indexOf('<footer>'), 'フッターの下に出ている');
  assert.ok(out.indexOf('<h1>店</h1>') < out.indexOf('id="laru-seo-articles"'));
  assert.equal(withSeoArticleSlot(out), out, '二重に差し込む');
  assert.ok(out.includes(`id="${SEO_ARTICLE_TARGET.slice(1)}"`), 'blog.js の data-target と置き場の id が違う');
  // 記事0件では見出しごと隠れる
  assert.match(out, /#laru-seo-articles:not\(:has\(\.card\)\)\{display:none\}/);
  const noFooter = withSeoArticleSlot('<div>本文</div></body>');
  assert.ok(noFooter.indexOf('id="laru-seo-articles"') < noFooter.indexOf('</body>'));
  assert.ok(withSeoArticleSlot('<div>本文</div>').endsWith('</section>'));
});

test('公開ページ: 設置タグはチャット1本・記事1本だけ。記事は置き場へ描く', () => {
  const s = readFileSync('app/hp/[slug]/page.tsx', 'utf8');
  assert.equal((s.match(/larubot\.tokyo\/static\/embed\.js" data-public-id/g) || []).length, 1);
  assert.equal((s.match(/larubot\.tokyo\/embed\/blog\.js" data-id/g) || []).length, 1);
  assert.match(s, /data-target=\{SEO_ARTICLE_TARGET\}/);
  assert.match(s, /<PublishedSite html=\{withSlot\}/, '置き場を入れたHTMLを出していない');
  // 置き場には記事一覧（/articles）への通常のリンクを渡す（M03・2026-10-04）
  assert.match(s, /const withSlot = blogId \? withSeoArticleSlot\(eagerHtml, listUrl\(base\)\) : eagerHtml;/, '記事を読まない人にも置き場を出している');
});

test('ダッシュボード: HP単体の人に「LARUbot未連携・Public IDを設定」を出さない', () => {
  const s = readFileSync('app/laruHP/dashboard/DashboardClient.tsx', 'utf8');
  assert.ok(!s.includes('Public IDを設定してください'), '入れる場所の無い入力を求めている');
  assert.ok(!s.includes('ビルダーで有効にして'), '自動設置なのに手作業を求めている');
  assert.match(s, /\{hasBot && site\.settings_json\?\.larubot !== false && \(/, 'Bot付きの契約でなくても出している');
  for (const claim of ['平均2.3倍', '検索順位が上がります', '毎週AIが']) assert.ok(!s.includes(claim), `裏付けの無い効果: ${claim}`);
});
