import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('予約管理の主要ショートカットは担当者・設備対応の管理画面へ進む', () => {
  const palette = read('../components/CommandPalette.tsx');
  assert.match(palette, /label: '予約管理',[\s\S]*description: '空き枠・担当者・設備',[\s\S]*router\.push\('\/laruHP\/booking\/schedule'\)/);
});

test('管理画面と登録導線に裏付けのない所要時間・改善倍率を表示しない', () => {
  const source = [
    read('../app/laruHP/dashboard/DashboardClient.tsx'),
    read('../components/OnboardingTour.tsx'),
    read('../app/laruHP/auth/signup/page.tsx'),
    read('../app/api/auth/callback/route.ts'),
  ].join('\n');
  assert.doesNotMatch(source, /2〜3倍|最短5分|5分で本格|5分で作り上げ/);
  assert.match(source, /完成像を確認/);
});
