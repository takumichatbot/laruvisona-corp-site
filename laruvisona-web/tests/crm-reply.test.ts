import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const route = fs.readFileSync(new URL('../app/api/crm/reply/route.ts', import.meta.url), 'utf8');

test('CRM返信は本文・宛名・サイト名をHTMLへ直接入れない', () => {
  assert.match(route, /escapeContactHtml\(message\.trim\(\)\)/);
  assert.match(route, /escapeContactHtml\(site\.name\)/);
  assert.match(route, /escapeContactHtml\(contact\.name\)/);
  assert.doesNotMatch(route, /\$\{site\.name\}<\/div>|\$\{contact\.name\} 様/);
});

test('CRM返信は所有サイトを確認し、DB障害と不存在を分ける', () => {
  assert.match(route, /\.eq\('user_id', user\.id\)/);
  assert.match(route, /if \(contactResult\.error\).*503/);
  assert.match(route, /if \(siteResult\.error\).*503/);
});

test('CRM返信は送信元確認・本文上限・時間あたり上限を持つ', () => {
  assert.match(route, /if \(!user\.email\)/);
  assert.match(route, /readContactBody\(req, 16_000\)/);
  assert.match(route, /message\.trim\(\)\.length > 5000/);
  assert.match(route, /claimPublicRate\(service, 'crm-reply', user\.id, 20\)/);
  assert.match(route, /rate === 'unavailable'/);
  assert.match(route, /status: 429/);
  assert.doesNotMatch(route, /new Map|req\.json\(\)/);
});
