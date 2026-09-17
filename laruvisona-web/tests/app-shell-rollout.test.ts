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
  'app/laruHP/analytics/page.tsx',
  'app/laruHP/calendar/page.tsx',
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
  'app/laruHP/admin/page.tsx': '濃色の画面。中身ごと配色を変える必要がある',
  'app/laruHP/agency/page.tsx': '濃色の画面。同上',
  'app/laruHP/blog/page.tsx': '濃色の画面。同上',
  'app/laruHP/booking/page.tsx': '濃色の画面。同上',
  'app/laruHP/contacts/page.tsx': '画面いっぱいの2枚組。骨組みの中に入れると高さが壊れる',
  'app/laruHP/builder/page.tsx': '編集画面。道しるべを出すと作業の幅が減る',
  'app/laruHP/edit/page.tsx': '編集画面。同上',
  'app/laruHP/studio/page.tsx': '編集画面。同上',
};

test('骨組みに乗せた画面は、自前の帯を持たない', () => {
  for (const file of ON_SHELL) {
    const code = read(file);
    assert.match(code, /<AppShell/, `${file} が AppShell を使っていない`);
    // 画面ごとの帯を作らない。題も戻る道も、骨組みの上段が出す。
    // （本文の中の「ダッシュボードへ」案内は別。これは道しるべではない。）
    assert.doesNotMatch(code, /<header\b/, `${file} がまだ自前の帯を持っている`);
    assert.doesNotMatch(code, /<h1\b/, `${file} が題を自前で出している`);
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

test('道しるべは1箇所から作る', () => {
  const shell = read('components/laruhp/AppShell.tsx');
  assert.match(shell, /from '@\/lib\/laruhp-nav'/);
  // 画面側にリンクの束を書き戻さないこと。
  for (const file of ON_SHELL) {
    assert.doesNotMatch(read(file), /NAV_GROUPS|NAV_PRIMARY/, `${file} が道しるべを自前で組んでいる`);
  }
});
