import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// LPの重さと、顧客に見せてはいけないものが混ざらないことの見張り。
//
// 実測（本番のリソースタイミング）で見つかった問題:
//   - /laruhp_logo.png が 1,879KB。ページ全体4.06MBの46%。
//     しかもロゴ表示ではなく manifest の PWA アイコン指定と
//     Service Worker のプリキャッシュで、全訪問者に降っていた。
//   - その manifest の中身が社内ツール「Bridge — AI Coding Assistant」だった。
//     ホーム画面に追加すると、顧客の端末に社内ツール名のアイコンが並ぶ。
//   - Font Awesome の CSS を CDN から全ページで読んでいたが、laruHP配下では
//     1つも使っていなかった（使用は会社サイト側の2ファイル・5種類のみ）。
//   - PwaInit がレイアウトにあり、LPを開いた瞬間に通知許可を要求していた。

const root = path.join(import.meta.dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');
const sizeKB = (p: string) => Math.round(fs.statSync(path.join(root, p)).size / 1024);

test('PWAアイコンは軽い', () => {
  for (const [f, max] of [
    ['public/laruhp-icon-192.png', 30],
    ['public/laruhp-icon-512.png', 120],
    ['public/laruhp-icon-maskable-192.png', 30],
    ['public/laruhp-icon-maskable-512.png', 120],
    ['public/apple-touch-icon.png', 30],
  ] as const) {
    assert.ok(fs.existsSync(path.join(root, f)), `${f} が無い`);
    assert.ok(sizeKB(f) <= max, `${f} が ${sizeKB(f)}KB（上限 ${max}KB）`);
  }
});

test('1.9MBのロゴを全訪問者に配らない', () => {
  const manifest = read('public/laruhp-manifest.json');
  assert.equal(/laruhp_logo\.png/.test(manifest), false, 'manifest が巨大ロゴを指している');
  const sw = read('public/sw.js');
  assert.equal(/laruhp_logo\.png/.test(sw), false, 'Service Worker が巨大ロゴをプリキャッシュしている');
  const layout = read('app/laruHP/layout.tsx');
  assert.match(layout, /rel="manifest" href="\/laruhp-manifest\.json"/);
  assert.equal(/rel="manifest" href="\/manifest\.json"/.test(layout), false,
    '社内ツール Bridge の manifest を顧客向けページで読んでいる');
});

test('顧客向けのmanifestに社内ツールの名前が入っていない', () => {
  const m = JSON.parse(read('public/laruhp-manifest.json'));
  assert.match(m.name, /LARU HP/);
  assert.equal(/Bridge|Coding Assistant|Claude Code/i.test(JSON.stringify(m)), false,
    '社内ツールの名前が顧客に見える');
  assert.match(m.start_url, /^\/laruHP\//);
  assert.ok(m.icons.some((i: { purpose?: string }) => i.purpose === 'maskable'),
    'Androidで丸く切られたときに崩れる（maskableが無い）');
});

test('使っていないアイコンフォントをCDNから読まない', () => {
  const layout = read('app/laruHP/layout.tsx');
  assert.equal(/font-awesome/i.test(layout.replace(/\{\/\*[\s\S]*?\*\/\}/g, '')), false,
    'laruHP配下では1つも使っていないのに読み込んでいる');
});

test('ランディングページを開いただけで通知許可を求めない', () => {
  const pwa = read('components/PwaInit.tsx');
  const body = pwa.slice(pwa.indexOf('export default function PwaInit'), pwa.indexOf('export async function requestPushPermission'));
  assert.equal(/requestPermission/.test(body), false,
    'ページを開いただけで通知許可のダイアログが出る');
  assert.match(pwa, /export async function requestPushPermission/,
    '利用者の操作から呼ぶための関数が無い');
});
