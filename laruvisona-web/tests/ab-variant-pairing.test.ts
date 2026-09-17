import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bareSource } from './helpers/bare-source';
import { exportToHTML } from '../lib/html-export';
import type { Block, Page, SEOSettings, SiteSettings } from '@/types/laruHP';

/**
 * A/Bテストで、来訪者の半分にトップの主役が出ていなかった。
 *
 * 編集画面にあるのは「このブロックをBバリアントに設定」の1つだけで、
 * **Aを指定する手立てが無い。** それなのに書き出す側はBにしか印を
 * 付けていなかった。振り分けの script は、印が自分の側と違うものを隠す。
 *
 *   ・ヒーローが1つで、それにBを付けた
 *     → 来訪者の半分に、**トップの主役が丸ごと出ない**
 *   ・ヒーローが2つで、片方だけBを付けた
 *     → 残り半分には、AとBが縦に2つ並ぶ
 *
 * 振り分けは sessionStorage で端末ごとに固定される。
 * だから**作った本人は毎回同じ側しか見ない。**
 * 自分の画面ではいつまでも正常に見えるので、気づきようがない。
 *
 * 直し方: 対（同じページの、印の無い同種のブロック）があるときだけ振り分ける。
 * 対が無ければ印を付けない ＝ 全員に出す。
 */

const read = (p: string) => bareSource(fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));

function hero(id: string, heading: string, extra: Record<string, unknown> = {}) {
  return { id, type: 'hero', data: { heading, subheading: '', ...extra } };
}
const seo: SEOSettings = { title: '', description: '', keywords: '', ogTitle: '', ogDescription: '', ogImage: '' };
const settings = {
  colorScheme: 'professional-blue', style: '', designStyle: 'modern',
  larubot: false, laruseo: false, fontFamily: 'noto', customCss: '',
  accentColor: '#f59e0b', heroLayout: 'center', headerStyle: 'solid', animLevel: 'subtle',
} as unknown as SiteSettings;

function render(blocks: unknown[]): string {
  const pages = [{ id: 'page-main', name: 'トップ', path: '/', blocks: blocks as Block[], seo }] as Page[];
  return exportToHTML(pages, seo, settings, 'テスト店');
}

test('相方が無いのにBを付けても、全員に出す', () => {
  // ここが本体。印を付けると、半分の人に何も出なくなっていた。
  const html = render([hero('h1', '朝、鏡の前で', { abVariant: 'b' })]);
  assert.doesNotMatch(html, /data-ab=/, '相方が無いのに印が付いている');
  assert.match(html, /朝、鏡の前で/, '本文が出ていない');
});

test('相方が無いときは、振り分けの仕掛けごと入れない', () => {
  // script が入っていると、印が無くても将来の変更で効き始める。
  const html = render([hero('h1', 'ひとつだけ', { abVariant: 'b' })]);
  assert.doesNotMatch(html, /laru_ab_/, '振り分けの仕掛けが入っている');
});

test('対があるときは、両方に印が付く', () => {
  const html = render([
    hero('h1', 'Aの見出し'),
    hero('h2', 'Bの見出し', { abVariant: 'b' }),
  ]);
  assert.match(html, /data-ab="a"/, '印の無いほうが a になっていない');
  assert.match(html, /data-ab="b"/, 'b の印が無い');
  assert.match(html, /laru_ab_/, '振り分けの仕掛けが入っていない');
  // どちらの本文も入っている（隠すのは見に来た人の画面でやる）
  assert.match(html, /Aの見出し/);
  assert.match(html, /Bの見出し/);
});

test('A/Bと関係のないブロックには、印を付けない', () => {
  // ここで印を付けると、片側の人に問い合わせ欄やナビが消える。
  const html = render([
    hero('h1', 'Aの見出し'),
    hero('h2', 'Bの見出し', { abVariant: 'b' }),
    { id: 'c1', type: 'contact', data: { heading: 'お問い合わせ' } },
    { id: 'n1', type: 'nav', data: {} },
  ]);
  const tagged = (html.match(/data-ab="/g) || []).length;
  assert.equal(tagged, 2, `印が${tagged}箇所ある（ヒーロー2つだけのはず）`);
  assert.match(html, /お問い合わせ/, '関係ないブロックが消えている');
});

test('別の種類どうしは、対にしない', () => {
  // ヒーローにBを付けたのに、見出しブロックが相方にされると
  // 片側の人には見出しが消える。
  const html = render([
    { id: 'x1', type: 'heading', data: { text: 'ただの見出し' } },
    hero('h1', 'ひとつだけ', { abVariant: 'b' }),
  ]);
  assert.doesNotMatch(html, /data-ab=/, '別の種類を相方にしている');
  assert.match(html, /ただの見出し/);
});

test('編集画面が、相方の無い状態をそのまま言う', () => {
  // 以前は「2つある場合、50/50で表示されます」とだけ書いてあり、
  // **無いときに何が起きるかは書いていなかった。**
  const builder = read('app/laruHP/builder/page.tsx');
  assert.match(builder, /比べる相手がありません/, '相方が無いことを言っていない');
  assert.match(builder, /abPartnerCount === 0/, '相方の数を見ていない');
  assert.doesNotMatch(builder, /同じページにヒーローが2つある場合、公開時に50\/50でランダム表示されます/,
    '古い説明が残っている');
});
