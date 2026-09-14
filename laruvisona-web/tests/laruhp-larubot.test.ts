import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../components/LarubotWidget.tsx', import.meta.url), 'utf8');
const landing = fs.readFileSync(new URL('../app/laruHP/page.tsx', import.meta.url), 'utf8');

test('LARU HP公開ホストは専用IDだけを使い、会社用ボットを混在させない', () => {
  assert.match(source, /laruHpHost\s*\?\s*process\.env\.NEXT_PUBLIC_LARUHP_BOT_PUBLIC_ID\s*:\s*companyId/);
  assert.doesNotMatch(source, /NEXT_PUBLIC_LARUHP_BOT_PUBLIC_ID\s*\|\|\s*companyId/);
  assert.doesNotMatch(source, /if\s*\(isLaruHpHost\([^)]*\)\)\s*return/);
});

test('会社ホストの管理画面・顧客サイト・予約確認画面には会社用ランチャーを重ねない', () => {
  assert.match(source, /!laruHpHost\s*&&\s*\(path\.startsWith\('\/laruHP'\)/);
  assert.match(source, /path\.startsWith\('\/hp'\)/);
  assert.match(source, /path\.endsWith\('\/reserve'\)/);
});

test('LARU HPの相談導線は会社サイトへ戻さず専用問い合わせへ集める', () => {
  assert.match(landing, /https:\/\/laruhp\.com\/contact/);
  assert.doesNotMatch(landing, /https:\/\/laruvisona\.jp\/contact/);
});
