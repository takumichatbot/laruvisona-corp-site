import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../components/LarubotWidget.tsx', import.meta.url), 'utf8');

test('LARU HP公開ホストでもLARUbotを止めず、専用IDから会社IDへ戻せる', () => {
  assert.match(source, /NEXT_PUBLIC_LARUHP_BOT_PUBLIC_ID\s*\|\|\s*companyId/);
  assert.doesNotMatch(source, /if\s*\(isLaruHpHost\([^)]*\)\)\s*return/);
});

test('会社ホストの管理画面・顧客サイト・予約確認画面には会社用ランチャーを重ねない', () => {
  assert.match(source, /!laruHpHost\s*&&\s*\(path\.startsWith\('\/laruHP'\)/);
  assert.match(source, /path\.startsWith\('\/hp'\)/);
  assert.match(source, /path\.endsWith\('\/reserve'\)/);
});
