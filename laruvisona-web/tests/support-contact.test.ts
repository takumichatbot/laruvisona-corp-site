import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('契約・認証・継続メールは実運用中の問い合わせ先を案内する', () => {
  for (const path of [
    'app/api/stripe/webhook/route.ts',
    'app/api/auth/callback/route.ts',
    'app/api/retention/send/route.ts',
  ]) {
    const source = read(path);
    assert.doesNotMatch(source, /support@laruvisona\.jp/);
    assert.match(source, /info@laruvisona\.jp/);
  }
});
