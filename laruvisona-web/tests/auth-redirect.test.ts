import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { safeLaruHpRedirect } from '../lib/auth-redirect.ts';

test('認証後の移動先はLARU HP内の相対URLだけを許可する', () => {
  assert.equal(safeLaruHpRedirect('/laruHP/studio?mood=elegant#preview'), '/laruHP/studio?mood=elegant#preview');
  assert.equal(safeLaruHpRedirect('/laruHP/invite/abc'), '/laruHP/invite/abc');
  for (const unsafe of [
    'https://example.com', '//example.com', '/\\example.com', '\\example.com',
    '/contact', ' javascript:alert(1)', '/laruHP.evil/path', '/laruHP\u0000/dashboard',
  ]) {
    assert.equal(safeLaruHpRedirect(unsafe), '/laruHP/dashboard', unsafe);
  }
});

test('新規登録は用途に合う安全な既定値を選べる', () => {
  assert.equal(safeLaruHpRedirect(null, '/laruHP/studio'), '/laruHP/studio');
  assert.equal(safeLaruHpRedirect('//example.com', '/laruHP/studio'), '/laruHP/studio');
});

test('招待はログインを挟んでも同じ招待画面へ戻る', () => {
  const invite = readFileSync(new URL('../app/laruHP/invite/[token]/page.tsx', import.meta.url), 'utf8');
  const accept = readFileSync(new URL('../app/api/sites/[id]/members/accept/route.ts', import.meta.url), 'utf8');
  assert.match(invite, /auth\/login\?redirectTo=/);
  assert.match(accept, /auth\/login\?redirectTo=/);
  assert.doesNotMatch(invite, /auth\/login\?redirect=/);
  assert.doesNotMatch(accept, /auth\/login\?redirect=/);
});
