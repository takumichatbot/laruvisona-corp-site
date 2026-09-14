import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DomainStoreReadError, isDomainMigrationMissing } from '../lib/domain-store-supabase.ts';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('独自ドメインの読み取り障害は不存在・空一覧・未使用へ変換しない', () => {
  const store = read('lib/domain-store-supabase.ts');
  assert.match(store, /getOwnedSite[\s\S]*if \(error\) throw new DomainStoreReadError/);
  assert.match(store, /listDomains[\s\S]*if \(error\) throw new DomainStoreReadError/);
  assert.match(store, /getDomain[\s\S]*if \(error\) throw new DomainStoreReadError/);
  assert.match(store, /isAgencyAdminHost[\s\S]*if \(error\) throw new DomainStoreReadError/);
});

test('未適用の表だけを移行待ちとして扱う', () => {
  assert.equal(isDomainMigrationMissing(new DomainStoreReadError('42P01')), true);
  assert.equal(isDomainMigrationMissing(new DomainStoreReadError('PGRST205')), true);
  assert.equal(isDomainMigrationMissing(new DomainStoreReadError('08006')), false);
  assert.equal(isDomainMigrationMissing(new Error('network')), false);
});

test('独自ドメインAPIは一般の読み取り障害を503で閉じる', () => {
  for (const path of [
    'app/api/sites/[id]/domain/route.ts',
    'app/api/sites/[id]/domain/verify/route.ts',
    'app/api/sites/[id]/domain/primary/route.ts',
  ]) {
    const route = read(path);
    assert.match(route, /独自ドメイン設定を確認できません/);
    assert.match(route, /status: 503/);
  }
});
