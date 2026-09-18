import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * 「初月無料で始める」——契約していない人が最初に押すボタン。
 * 2026-09-19まで、失敗をどこにも出していなかった。決済側が
 * 429（連打）・503（料金の確認中）・400 を返しても、押した人には何も起きない。
 */
const src = readFileSync('app/laruHP/dashboard/DashboardClient.tsx', 'utf8');
const fn = src.slice(src.indexOf('const handleCheckout = async () => {'), src.indexOf('};', src.indexOf('const handleCheckout = async () => {')) + 2);

test('失敗したら、押した人に見える形で知らせる', () => {
  assert.match(fn, /setPublishToast\(\{ message: data\.error \|\| /, '決済側の理由を出していない');
  assert.match(fn, /catch \{[\s\S]*?setPublishToast\(\{ message: '通信に失敗しました/, '通信失敗を出していない');
});

test('成功のときだけ遷移する（res.ok を見る）', () => {
  assert.match(fn, /if \(res\.ok && data\.url\) \{ window\.location\.href = data\.url; return; \}/);
});

test('連打で決済セッションを増やさない', () => {
  assert.match(fn, /if \(checkoutStarting\) return;/);
  assert.match(fn, /finally \{\s*setCheckoutStarting\(false\);/);
  assert.match(src, /disabled=\{checkoutStarting\}/, 'ボタンを押せないようにしていない');
});

test('応答が JSON でなくても落ちない', () => {
  assert.match(fn, /res\.json\(\)\.catch\(\(\) => \(\{\}\)\)/);
});
