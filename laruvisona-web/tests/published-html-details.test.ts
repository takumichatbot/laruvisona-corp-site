import test from 'node:test';
import assert from 'node:assert/strict';
import { exportToHTML } from '../lib/html-export';
import type { Block, Page, SEOSettings, SiteSettings } from '@/types/laruHP';

/**
 * 公開サイトの細かい壊れ。どれも「作った本人には見えない」形をしている。
 *
 * ・編集者向けの文言が、お店のページにそのまま出ていた
 * ・同じ種類のブロックを2つ置くと、**先に置いたほうが壊れる**
 * ・お店の人が打った文字を逃がさずに組み立てていた
 * ・Cookieの帯のリンクが、お店のポリシーには決して飛ばない
 */

const seo: SEOSettings = { title: '', description: '', keywords: '', ogTitle: '', ogDescription: '', ogImage: '' };
const baseSettings = {
  colorScheme: 'professional-blue', style: '', designStyle: 'modern',
  larubot: false, laruseo: false, fontFamily: 'noto', customCss: '',
  accentColor: '#f59e0b', heroLayout: 'center', headerStyle: 'solid', animLevel: 'subtle',
} as unknown as SiteSettings;

function render(blocks: unknown[], settings: SiteSettings = baseSettings): string {
  const pages = [{ id: 'page-main', name: 'トップ', path: '/', blocks: blocks as Block[], seo }] as Page[];
  return exportToHTML(pages, seo, settings, 'テスト店');
}

test('商品を選んでいない商品ブロックは、公開ページに出さない', () => {
  // 以前は「（商品が選択されていません）」が節として出ていた。
  // 編集画面では自分への注意書きに見えるので、公開側にも出ているとは思わない。
  // 見に来た人には、ただ壊れている店に見える。
  const html = render([
    { id: 'h', type: 'hero', data: { heading: 'お店の名前' } },
    { id: 's1', type: 'shop-item', data: {} },
  ]);
  assert.doesNotMatch(html, /商品が選択されていません/, '編集者向けの文言が公開ページに出ている');
  assert.match(html, /お店の名前/, '他のブロックまで消えている');
});

test('カウントダウンを2つ置いても、両方動く', () => {
  // 以前は cd-d / cd-h / cd-m / cd-s の決め打ちで、
  // **2つ目は00のまま止まり、1つ目には2つ目の日付が出ていた。**
  const html = render([
    { id: 'c1', type: 'countdown', data: { heading: '開店まで', targetDate: '2026-12-01T00:00' } },
    { id: 'c2', type: 'countdown', data: { heading: '締切まで', targetDate: '2026-10-01T00:00' } },
  ]);
  for (const part of ['d', 'h', 'm', 's']) {
    assert.match(html, new RegExp(`id="cd-${part}-c1"`), `1つ目の${part}の名前が分かれていない`);
    assert.match(html, new RegExp(`id="cd-${part}-c2"`), `2つ目の${part}の名前が分かれていない`);
  }
  assert.doesNotMatch(html, /id="cd-d"/, '決め打ちの名前が残っている');
});

test('ポップアップを2つ置いても、2つ目が出る', () => {
  // 以前は名前も「出したか」の記録も共有で、**2つ目は永久に出なかった。**
  // 閉じるボタンも、どちらを押しても1つ目を閉じにいっていた。
  const html = render([
    { id: 'p1', type: 'popup', data: { heading: '1つ目', text: 'あ', trigger: 'delay', delay: '3' } },
    { id: 'p2', type: 'popup', data: { heading: '2つ目', text: 'い', trigger: 'exit' } },
  ]);
  assert.match(html, /id="lhp-popup-p1"/);
  assert.match(html, /id="lhp-popup-p2"/);
  assert.match(html, /lhp-popup-shown-p1/);
  assert.match(html, /lhp-popup-shown-p2/);
  assert.doesNotMatch(html, /id="lhp-popup-overlay"/, '決め打ちの名前が残っている');
  assert.doesNotMatch(html, /sessionStorage\.getItem\('lhp-popup-shown'\)/, '記録を共有している');
});

test('お知らせの一覧は、お店の人が打った文字を逃がす', () => {
  // 記事の一覧は公開後にJSで読み込む所で、編集画面のプレビューには出ない。
  // ショップ側には同じ役の esc() があるのに、ここだけ無かった。
  const html = render([{ id: 'n1', type: 'news', data: { heading: 'お知らせ' } }]);
  assert.match(html, /function esc\(t\)/, '逃がす仕掛けが無い');
  assert.match(html, /esc\(p\.title\)/, 'タイトルを逃がしていない');
  assert.match(html, /esc\(p\.category\)/, '分類を逃がしていない');
  assert.match(html, /encodeURIComponent\(p\.id\)/, '記事IDをそのままURLへ入れている');
});

test('Cookieの帯は、行き先が無いならリンクを出さない', () => {
  // 以前は /privacy 決め打ちで、**お店のポリシーには決して飛ばなかった。**
  //   標準URLでは LaruVisona社のポリシーへ、独自ドメインでは404。
  const html = render([{ id: 'h', type: 'hero', data: { heading: 'お店' } }]);
  assert.doesNotMatch(html, /href="\/privacy"/, '無い行き先を指している');
  assert.match(html, /Cookieを使用して/, '帯そのものが消えている');
});

test('Cookieの帯は、お店が用意していればそこへ飛ばす', () => {
  const withFooter = {
    ...baseSettings,
    globalFooter: {
      enabled: true, logo: '', tagline: '', sns: [], copyright: '', bgColor: '#111', textColor: '#fff',
      links: [{ label: 'プライバシーポリシー', href: 'https://example.com/privacy' }],
    },
  } as unknown as SiteSettings;
  const html = render([{ id: 'h', type: 'hero', data: { heading: 'お店' } }], withFooter);
  assert.match(html, /href="https:\/\/example\.com\/privacy"/);
  assert.match(html, /プライバシーポリシー<\/a>/);
});

test('店舗の構造化データは、1箇所からだけ出す', () => {
  // 公開HTMLにも焼き込んでいたので、検索側には**食い違う情報が2件**見えていた。
  //   焼き込み側: 住所も電話もいつも空・URLは必ず laruvisona.jp/hp/<slug>
  //   ページ側  : 住所も営業時間も独自ドメインのURLも入った正しいもの
  // 構造化データは見た目に出ず、検索結果に出るまで数週間かかるので気づかない。
  const html = render([{ id: 'h', type: 'hero', data: { heading: 'お店' } }]);
  assert.doesNotMatch(html, /application\/ld\+json/, '公開HTMLに構造化データが残っている');
});
