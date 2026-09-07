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
