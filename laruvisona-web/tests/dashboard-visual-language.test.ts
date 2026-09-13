import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../app/laruHP/dashboard/DashboardClient.tsx', import.meta.url),
  'utf8',
);

const pictographs = /\p{Extended_Pictographic}/u;

test('管理ダッシュボードは端末依存の絵文字を操作や状態の表示に使わない', () => {
  assert.doesNotMatch(source, pictographs);
  assert.match(source, /function DashboardIcon/);
  assert.match(source, /通知音: ON/);
  assert.match(source, /優勢/);
  assert.match(source, /label: 'サイト作成'/);
});

test('公開・警告・通知の状態は文字だけに依存しない', () => {
  assert.match(source, /publishToast\.type === 'warn' \? <IcAlert \/> : <IcCheck \/>/);
  assert.match(source, /soundEnabled \? <IcBell \/> : <IcBellOff \/>/);
  assert.match(source, /<DashboardIcon name="publish"/);
});
