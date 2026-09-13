import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const route = fs.readFileSync(new URL('../app/api/inquiry/route.ts', import.meta.url), 'utf8');

test('会社問い合わせは本文サイズ・型・長さ・メール形式を検査する', () => {
  assert.match(route, /readContactBody\(req, 20_000\)/);
  assert.match(route, /name\.length > 100/);
  assert.match(route, /message\.length > 10_000/);
  assert.match(route, /\[\^\\s@\]\+@/);
});

test('会社問い合わせはHTMLと件名を無害化する', () => {
  assert.match(route, /escapeContactHtml\(message\)/);
  assert.match(route, /escapeContactHtml\(email\)/);
  assert.match(route, /singleLine\(name\)/);
});

test('メール未設定とResend戻り値の失敗を成功にしない', () => {
  assert.match(route, /送信機能を利用できません[\s\S]*status: 503/);
  assert.match(route, /if \(result\.error\) throw/);
});
