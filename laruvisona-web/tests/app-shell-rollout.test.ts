import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * ログイン後の画面が、同じ骨組みに乗っているかの検査。
 *
 * もともと道しるべ（23本のリンク）はダッシュボードの本文の中にしか無かった。
 * ほかの画面へ入ると消えるので、次にどこへ行けるのかが分からず、
 * 戻るにはブラウザの戻るしかない。画面ごとに「← ダッシュボード」を
 * 1本ずつ書いて、それで済ませていた。
 *
 * AppShell に寄せた画面が、また自前の帯を生やしていないかを見る。
 */

const root = new URL('../', import.meta.url).pathname;
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

/** 骨組みに乗せた画面。ここから減らさないこと。 */
const ON_SHELL = [
  'app/laruHP/dashboard/DashboardClient.tsx',
  'app/laruHP/ab-test/page.tsx',
  'app/laruHP/admin/page.tsx',
  'app/laruHP/agency/page.tsx',
  'app/laruHP/blog/page.tsx',
  'app/laruHP/booking/page.tsx',
  'app/laruHP/analytics/page.tsx',
  'app/laruHP/calendar/page.tsx',
  'app/laruHP/contacts/page.tsx',
  'app/laruHP/crm/page.tsx',
  'app/laruHP/heatmap/page.tsx',
  'app/laruHP/larubot-logs/page.tsx',
  'app/laruHP/loyalty/page.tsx',
  'app/laruHP/members/page.tsx',
  'app/laruHP/newsletter/page.tsx',
  'app/laruHP/orders/page.tsx',
  'app/laruHP/payments/page.tsx',
  'app/laruHP/popups/page.tsx',
  'app/laruHP/seo/page.tsx',
  'app/laruHP/sequences/page.tsx',
  'app/laruHP/settings/page.tsx',
  'app/laruHP/shop/page.tsx',
  'app/laruHP/translate/page.tsx',
];

/**
 * まだ乗せていない画面と、その理由。
 * 数を減らすのが仕事。増やすときは理由を書くこと。
 */
const NOT_YET: Record<string, string> = {
  'app/laruHP/builder/page.tsx': '編集画面。道しるべを出すと作業の幅が減る',
  'app/laruHP/edit/page.tsx': '編集画面。同上',
  'app/laruHP/studio/page.tsx': '編集画面。同上',
};

/**
 * もとは濃色（白文字）で書かれていた画面。明色の骨組みに乗せたので、
 * 白い文字を残すと**面に溶けて読めなくなる**。
 * 色の付いたボタンの上だけは白のままでよい。
 */
const WAS_DARK = [
  'app/laruHP/admin/page.tsx',
  'app/laruHP/agency/page.tsx',
  'app/laruHP/blog/page.tsx',
  'app/laruHP/booking/page.tsx',
];

test('明色に直した画面に、面へ溶ける文字を残さない', () => {
  const onColour = /bg-(?:sky|red|rose|emerald|green|amber|indigo|purple|violet|gray-[789])/;
  for (const file of WAS_DARK) {
    const lines = read(file).split('\n');
    lines.forEach((line, i) => {
      if (line.includes('text-white') && !onColour.test(line)) {
        assert.fail(`${file}:${i + 1} 白い文字が、色の付いた面の上に無い`);
      }
      // 濃い面そのものが残っていないか
      assert.doesNotMatch(line, /bg-\[#0[0-9a-f]{5}\]/, `${file}:${i + 1} 濃い面が残っている`);
      assert.doesNotMatch(line, /text-slate-[345]00/, `${file}:${i + 1} 濃色向けの文字色が残っている`);
    });
  }
});

test('骨組みに乗せた画面は、自前の帯を持たない', () => {
  for (const file of ON_SHELL) {
    const code = read(file);
    assert.match(code, /<AppShell/, `${file} が AppShell を使っていない`);
    // 画面ごとの帯を作らない。題も戻る道も、骨組みの上段が出す。
    // （本文の中の「ダッシュボードへ」案内は別。これは道しるべではない。
    //   骨組みの外に出す独立した画面――暗証番号・プラン違いの案内――も別。）
    const inside = code.slice(code.indexOf('<AppShell'));
    assert.doesNotMatch(inside, /<header\b/, `${file} がまだ自前の帯を持っている`);
    assert.doesNotMatch(inside, /<h1\b/, `${file} が題を自前で出している`);
  }
});

test('骨組みに乗せた画面は、画面いっぱいの入れ物を二重に持たない', () => {
  // AppShell の中で min-h-screen を張ると、上段の分だけ縦に溢れる。
  for (const file of ON_SHELL) {
    const code = read(file);
    const shellAt = code.indexOf('<AppShell');
    assert.ok(shellAt > 0, file);
    assert.doesNotMatch(code.slice(shellAt), /min-h-screen/, `${file} が AppShell の中で min-h-screen を張っている`);
  }
});

test('まだ乗せていない画面の一覧が、実際と合っている', () => {
  for (const [file, why] of Object.entries(NOT_YET)) {
    assert.ok(fs.existsSync(path.join(root, file)), `${file} が無い`);
    assert.ok(why.length > 5, `${file} に理由が書かれていない`);
    // 乗せたら、この一覧から消して ON_SHELL へ移すこと。
    assert.doesNotMatch(read(file), /<AppShell/, `${file} は乗ったので一覧を移す`);
  }
});

test('画面いっぱいの画面は、詰めて出す型を使う', () => {
  // 骨組みの余白のまま入れると、2枚組の高さが画面を超えて
  // ページ全体が縦に動き、上段が流れていってしまう。
  const contacts = read('app/laruHP/contacts/page.tsx');
  assert.match(contacts, /\n\s+fill\n/, '問い合わせ画面は fill で出す');
  assert.match(contacts, /flex flex-1 min-h-0/, '中身が自分で高さを分け合うこと');

  const css = read('app/laruHP/app-shell.css');
  assert.match(css, /\.shell\.is-fill \.shell-main \{[^}]*overflow: hidden/, 'ページ全体は動かさない');
  assert.match(css, /\.shell\.is-fill \.shell-content \{[^}]*min-height: 0/, '中身が縮めること');
});

test('道しるべは1箇所から作る', () => {
  const shell = read('components/laruhp/AppShell.tsx');
  assert.match(shell, /from '@\/lib\/laruhp-nav'/);
  // 画面側にリンクの束を書き戻さないこと。
  for (const file of ON_SHELL) {
    assert.doesNotMatch(read(file), /NAV_GROUPS|NAV_PRIMARY/, `${file} が道しるべを自前で組んでいる`);
  }
});
