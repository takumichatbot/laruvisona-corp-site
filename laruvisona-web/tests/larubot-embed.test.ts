import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * LARUbot の埋め込みまわり。
 *
 * ここは「出ていないことに、こちらが気づけない」種類の欠けが集まる場所。
 * ランチャーが出なくても、ブログの記事が0件でも、エラーは1つも出ない。
 * 気づくのはサイトの持ち主だけで、その人は黙って帰る。
 * だから、直したことを検査で押さえておく。
 */

const read = (path: string) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('よそのブラウザAPIを、こちらで差し替えない', () => {
  const widget = read('components/LarubotWidget.tsx');
  // 2026-09-17 まで requestIdleCallback を丸ごと差し替えていた。
  // 向こうが { timeout: 2000 } を付けたので外した。
  // 同じ問題が再発したら、ここで差し替えるのではなく向こうに直してもらう。
  assert.doesNotMatch(widget, /window as unknown as[\s\S]{0,200}requestIdleCallback/);
  assert.doesNotMatch(widget, /w\.requestIdleCallback\s*=/);
});

test('ブログの記事は、向こうの script 札ではなくサーバー側で取る', () => {
  // blog.js は自分の <script> の直前に器を差し込む作りで、
  // 描画位置を決めるために動的注入という回避が要った。
  // サーバー側で描くようにしたので、回避ごと不要になった。
  assert.ok(!fs.existsSync(new URL('../components/LaruSeoBlog.tsx', import.meta.url)));
  const page = read('app/blog/page.tsx');
  assert.doesNotMatch(page, /blog\.js|createElement\('script'\)/);
  assert.match(page, /listArticles/);
});

test('埋め込みは、管理画面と顧客の公開サイトには出さない', () => {
  const widget = read('components/LarubotWidget.tsx');
  // 会社のボットが、お客様のサイトや管理画面に出ると別ブランドが混ざる。
  assert.match(widget, /path\.startsWith\('\/laruHP'\)/);
  assert.match(widget, /path\.startsWith\('\/hp'\)/);
  assert.match(widget, /larubot-embed-script/, '二重に読み込まない目印');
});
