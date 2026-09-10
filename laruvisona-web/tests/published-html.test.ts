// 公開HTMLの品質に関する回帰テスト。
// 見た目の良し悪しはテストできないが、「入れ忘れると素人臭くなる」
// 土台の指定と、体感速度・アクセシビリティに直結する指定は固定できる。

import assert from 'node:assert/strict';
import test from 'node:test';

process.env.NEXT_PUBLIC_APP_URL = 'https://laruvisona.jp';

const { exportToHTML, EXPORT_VERSION } = await import('../lib/html-export.ts');

const seo = { title: 'テスト院', description: '説明', keywords: '', ogTitle: '', ogDescription: '', ogImage: '' };
const settings = {
  colorScheme: 'blue', style: 'clean', designStyle: 'modern',
  larubot: false, laruseo: false,
  accentColor: '#0ea5e9', heroLayout: 'center' as const,
  headerStyle: 'transparent' as const, animLevel: 'full' as const,
};

function render(blocks: Array<{ id: string; type: string; data: Record<string, unknown> }>) {
  const page = { id: 'home', name: 'ホーム', path: '/', blocks: blocks as never, seo };
  return exportToHTML([page], seo, settings, 'テスト院');
}

const basic = render([
  { id: 'b1', type: 'hero', data: { heading: '見出し', subheading: 'サブ', ctaText: 'CTA', ctaLink: '#', bgColor: '#0f172a', textColor: '#fff' } },
]);

test('和文タイポグラフィの土台が入っている（palt・禁則・行の均し）', () => {
  assert.match(basic, /font-feature-settings:'palt' 1/, 'palt が無いと和文の字間が間延びして素人臭くなる');
  assert.match(basic, /text-wrap:balance/, '見出しの行の均しが無い');
  assert.match(basic, /line-break:strict/, '和文の禁則指定が無い');
});

test('キーボード操作のフォーカスが必ず見える', () => {
  assert.match(basic, /:focus-visible\{[^}]*outline:3px solid/, 'フォーカスリングが無い');
  // 入力欄は outline:none を当てているので、打ち消しが後ろに来ていること
  const noneAt = basic.indexOf('outline:none');
  const ringAt = basic.indexOf('focus-visible');
  assert.ok(noneAt === -1 || ringAt > noneAt, 'outline:none より後ろに focus-visible が無い');
});

test('動きを減らす設定を尊重し、その場合も内容は見える', () => {
  assert.match(basic, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(basic, /\[data-lhp-anim\]\{opacity:1!important;transform:none!important\}/,
    '動きを止めたときにスクロールアニメが透明のまま残る');
});

test('注意を引くアニメは永久ループしない（ホバー時のみ継続）', () => {
  assert.ok(!/animation:lhpPulse [^;}]*infinite\}/.test(basic) || /:hover\{animation:lhpPulse[^;}]*infinite/.test(basic),
    'CTA が常時点滅し続けている');
  assert.match(basic, /\.lhp-btn-primary\{animation:lhpPulse 2\.8s ease-in-out 3\}/);
});

test('常時動く背景装飾はスマホでは止める', () => {
  assert.match(basic, /body::before,body::after\{animation:none!important;display:none!important\}/);
});

test('先頭の画像は遅延読み込みにしない（LCPが遅れる）', () => {
  const html = render([
    { id: 'b1', type: 'hero', data: { heading: 'h', subheading: 's', ctaText: 'c', ctaLink: '#' } },
    { id: 'b2', type: 'team', data: { heading: 'スタッフ', items: [
      { name: 'A', role: '院長', photo: 'https://example.com/a.jpg', bio: '' },
      { name: 'B', role: 'スタッフ', photo: 'https://example.com/b.jpg', bio: '' },
    ] } },
  ]);
  const first = html.indexOf('https://example.com/a.jpg');
  const second = html.indexOf('https://example.com/b.jpg');
  assert.ok(first > 0 && second > first, 'テスト用の画像が出力されていない');
  const firstTag = html.slice(html.lastIndexOf('<img', first), first);
  const secondTag = html.slice(html.lastIndexOf('<img', second), second);
  assert.match(firstTag, /fetchpriority="high"/, '先頭画像に fetchpriority が無い');
  assert.ok(!/loading="lazy"/.test(firstTag), '先頭画像が遅延読み込みになっている');
  assert.match(secondTag, /loading="lazy"/, '2枚目以降が遅延読み込みになっていない');
});

test('生成HTMLを変えたら EXPORT_VERSION を上げる（既存の公開HTMLが再生成される）', () => {
  assert.ok(EXPORT_VERSION >= 3, '公開HTMLを変更したのに EXPORT_VERSION が上がっていない');
  assert.match(basic, new RegExp(`<!--lhpv:${EXPORT_VERSION}-->$`), '版数の埋め込みが末尾に無い');
});

// ── 動きを切ったときに、内容が隠れないこと ──────────────
//
// 美容室の基準作品を組んでいて見つかった。
// 公開HTMLには表示アニメーションが2系統ある:
//   1. [data-lhp-anim] … 節ごと。animLevel を見ている（上のテストで固定済み）
//   2. .lhp-fade       … ギャラリーの写真・質問・料金表・カード。**見ていなかった**
// そのため animLevel:'none' を選んでも 2 は opacity:0 で始まり、
// スクロールするまで出てこなかった。印刷・スクリーンショット・
// スクロールしない閲覧では、最後まで空白のままになる。

function renderWithAnim(anim: 'none' | 'subtle' | 'full') {
  const blocks = [
    { id: 'b1', type: 'hero', data: { heading: '見出し', subheading: 'サブ', ctaText: 'CTA', ctaLink: '#', bgColor: '#0f172a', textColor: '#fff' } },
    { id: 'b2', type: 'gallery', data: { heading: 'スタイル', images: ['/a.jpg', '/b.jpg'], columns: '2' } },
    { id: 'b3', type: 'faq', data: { heading: 'よくある質問', items: [{ q: 'Q1', a: 'A1' }] } },
  ];
  const page = { id: 'home', name: 'ホーム', path: '/', blocks: blocks as never, seo };
  return exportToHTML([page], seo, { ...settings, animLevel: anim }, 'テスト院');
}

/** .lhp-fade を付ける処理の直前に、早期returnがあるか */
function fadeGuard(html: string): string {
  const i = html.indexOf("var els=document.querySelectorAll('.lhp-section-wrap");
  assert.ok(i > -1, '.lhp-fade を付ける処理が見つからない');
  return html.slice(Math.max(0, i - 800), i);
}

test('動きなしを選んだら、写真・質問・料金表も隠された状態から始まらない', () => {
  const html = renderWithAnim('none');
  assert.match(html, /\[data-lhp-anim\]\{opacity:1!important/);
  assert.match(fadeGuard(html), /if\('none'==='none'\)return;/,
    'animLevel を見ずに .lhp-fade を付けている（内容が空白のままになる）');
});

test('動きありのときは、これまでどおり順に出る', () => {
  for (const lv of ['subtle', 'full'] as const) {
    const html = renderWithAnim(lv);
    assert.equal(/if\('none'==='none'\)return;/.test(html), false, `${lv} で止めてしまっている`);
    assert.match(html, /IntersectionObserver/, `${lv} でスクロール連動が消えている`);
    assert.match(html, /lhp-fade\{opacity:0/, `${lv} で仕掛けが入っていない`);
  }
});

test('端末が「動きを減らす」設定なら、写真・質問も隠さない', () => {
  const guard = fadeGuard(renderWithAnim('full'));
  assert.match(guard, /prefers-reduced-motion: reduce/,
    '端末の設定を見ていない（動きを減らす設定の人に内容が出ない恐れ）');
  assert.match(guard.slice(guard.indexOf('prefers-reduced-motion')), /return/,
    '見ているだけで止めていない');
});

// ── シンプル予約フォーム ──────────────────────────────
//
// 監督レビュー(5348247)1: 入力に name が無いのに f.name.value を読んでいた。
// f.name は「フォーム自身の name 属性」を返すので、入力欄は取れない。
// f.email / f.phone に至っては undefined で、送信前に例外で落ちていた。

const booking = exportToHTML(
  [{ id: 'home', name: 'ホーム', path: '/', seo, blocks: [
    { id: 'p1', type: 'price-table', data: { heading: '料金', plans: [
      { name: 'カラー＋カット', price: '13,200', period: '円〜', description: '', features: [], highlighted: true, buttonText: '予約', buttonLink: '#booking' },
    ] } },
    { id: 'bk', type: 'booking', data: {
      mode: 'simple', heading: 'ご予約', subtext: '',
      serviceTypes: ['カット', 'カラー＋カット'], timeSlots: ['10:00', '11:00'],
      buttonText: '申し込む', buttonColor: '#8a6a43', bgColor: '#fff',
      stickyCta: true, stickyCtaText: '予約する',
    } },
  ] }] as never,
  seo, settings, 'テスト店',
);

test('予約フォームの入力から、値が取れる形になっている', () => {
  // 値の取り出しはフォームのプロパティに頼らない
  assert.equal(/f\.name\.value|f\.email\.value|f\.phone\.value/.test(booking), false,
    'フォーム自身のプロパティから入力値を取ろうとしている（送信前に落ちる）');
  assert.match(booking, /function val\(k\)\{var el=f\.querySelector\('\[data-bk="'\+k\+'"\]'\)/);
  for (const k of ['service', 'date', 'time', 'name', 'phone', 'email']) {
    assert.match(booking, new RegExp(`data-bk="${k}"`), `入力の目印が無い: ${k}`);
  }
  // ラベルと入力がひも付いている
  for (const id of ['lhp-bkf-service', 'lhp-bkf-date', 'lhp-bkf-time']) {
    assert.match(booking, new RegExp(`for="${id}"`), `ラベルがひも付いていない: ${id}`);
    assert.match(booking, new RegExp(`id="${id}"`));
  }
  // 送信する中身
  assert.match(booking, /name:val\('name'\),email:val\('email'\),phone:val\('phone'\)/);
});

test('送信に失敗したら、押し直せる状態に戻る', () => {
  assert.match(booking, /btn\.textContent=label;btn\.disabled=false/);
  assert.match(booking, /もう一度お試しください/);
  // HTTPの失敗も成否に含める
  assert.match(booking, /if\(r\.ok&&d\.ok\)/, 'HTTPの失敗を成功として扱っている');
});

test('料金表で選んだメニューが、予約の欄に引き継がれる', () => {
  assert.match(booking, /data-lhp-menu="カラー＋カット"/, '料金表のボタンがメニュー名を持っていない');
  assert.match(booking, /function pickService\(label\)/);
  assert.match(booking, /sel\.options\[i\]\.text===label/, '選択肢の文言で突き合わせていない');
});

test('スマホの固定予約ボタンは、実際のリンクとして出る', () => {
  // CSSだけの飾りではなく、押せる要素があること
  assert.match(booking, /<div class="lhp-sticky-cta"[^>]*>\s*<a href="#booking" class="lhp-sticky-cta-btn"/);
  assert.match(booking, /予約する<\/a>/);
  assert.match(booking, /\.lhp-sticky-cta-btn\{[^}]*min-height:52px/, '指で押せる高さが無い');
  assert.match(booking, /env\(safe-area-inset-bottom\)/, 'ホームバーに重なる');
});

test('固定予約ボタンは、設定で出し入れできる', () => {
  const off = exportToHTML(
    [{ id: 'home', name: 'ホーム', path: '/', seo, blocks: [
      { id: 'bk', type: 'booking', data: { mode: 'simple', heading: 'ご予約', subtext: '', serviceTypes: ['カット'], timeSlots: ['10:00'], buttonText: '申し込む', buttonColor: '#000', bgColor: '#fff' } },
    ] }] as never,
    seo, settings, 'テスト店',
  );
  assert.equal(/lhp-sticky-cta"/.test(off), false, '設定していないのに固定ボタンが出ている');
});

test('左右に分けるヒーローは、写真が主役になる幅を持つ', () => {
  // 内側の幅を広げないと、写真が42%＝約300pxにしかならず、
  // 1440pxの画面で切手のように小さく見えていた。
  const split = exportToHTML(
    [{ id: 'home', name: 'ホーム', path: '/', seo, blocks: [
      { id: 'h', type: 'hero', data: { heading: '店名', subheading: 'サブ', ctaText: '予約', ctaLink: '#booking', bgColor: '#2a2724', textColor: '#fff', bgImage: '/hero.jpg' } },
    ] }] as never,
    seo, { ...settings, heroLayout: 'split' as const }, 'テスト店',
  );
  assert.match(split, /\.lhp-hero-split \.lhp-hero-inner\{[^}]*max-width:1180px/, '内側が広がっていない');
  assert.match(split, /\.lhp-hero-split-img\{flex:1 1 54%/, '写真の取り分が小さいまま');
  assert.match(split, /<div class="lhp-hero-split-img"><img src="\/hero\.jpg"/);
});
