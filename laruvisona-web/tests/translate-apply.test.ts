import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { applyTranslationToHtml, translationFor, isTranslationLocale } from '../lib/translate-apply';

const code = (p: string) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('本文の文章だけを訳す', () => {
  const html = '<h1>結い庵</h1><p>予約制のヘアサロンです。</p>';
  const out = applyTranslationToHtml(html, { '結い庵': 'Yui-an', '予約制のヘアサロンです。': 'A hair salon by appointment.' });
  assert.equal(out, '<h1>Yui-an</h1><p>A hair salon by appointment.</p>');
});

test('タグの中（属性・スクリプト・スタイル）には触らない', () => {
  const html = '<img alt="結い庵" src="/a.jpg"><script>var s="結い庵";</script><style>.x{content:"結い庵"}</style><p>結い庵</p>';
  const out = applyTranslationToHtml(html, { '結い庵': 'Yui-an' });
  assert.ok(out.includes('alt="結い庵"'), '属性を書き換えると表示や動作が壊れる');
  assert.ok(out.includes('var s="結い庵"'), 'スクリプトの中身を訳してはいけない');
  assert.ok(out.includes('content:"結い庵"'));
  assert.ok(out.includes('<p>Yui-an</p>'));
});

test('前後の空白と改行を保つ', () => {
  const out = applyTranslationToHtml('<p>\n  こんにちは\n</p>', { 'こんにちは': 'Hello' });
  assert.equal(out, '<p>\n  Hello\n</p>');
});

test('対応表に無い文章はそのまま', () => {
  const html = '<p>訳していない文章</p>';
  assert.equal(applyTranslationToHtml(html, { 'ほか': 'other' }), html);
  assert.equal(applyTranslationToHtml(html, {}), html);
  assert.equal(applyTranslationToHtml(html, null), html);
});

test('訳文のタグは実体参照にして、HTMLを壊さない', () => {
  const out = applyTranslationToHtml('<p>あ</p>', { 'あ': '<b>x</b>' });
  assert.ok(!out.includes('<b>'), '訳文からタグを注入させない');
  assert.ok(out.includes('&lt;b&gt;'));
});

test('保存された翻訳の取り出しは、中身があるときだけ成功する', () => {
  const settings = { translations: { en: { map: { a: 'A' }, translatedAt: 'x' }, ko: { map: {} } } };
  assert.ok(translationFor(settings, 'en'));
  assert.equal(translationFor(settings, 'ko'), null, '中身が空なら「翻訳あり」と扱わない');
  assert.equal(translationFor(settings, 'fr'), null);
  assert.equal(translationFor(null, 'en'), null);
  assert.ok(isTranslationLocale('zh'));
  assert.ok(!isTranslationLocale('jp'));
});

test('公開ページが ?lang= を読んで翻訳をあてる', () => {
  const page = code('app/hp/[slug]/page.tsx');
  assert.match(page, /applyTranslationToHtml/, '翻訳しても公開ページに出ないなら、翻訳機能は無いのと同じ');
  assert.match(page, /searchParams/);
  assert.match(page, /languages/, '用意した言語を検索側に伝える');
});

test('翻訳のもとになる文章を、いまのブロック構造から集める', () => {
  const api = code('app/api/ai/translate/route.ts');
  assert.match(api, /pages/, 'v2（pages）の保存形式を見ていないと、集まる文章が空になる');
  assert.match(api, /data/);
  assert.doesNotMatch(api, /block\.props \|\| \{\}/, '存在しない props を読んでいた頃の実装に戻っている');
});
