import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  loyaltyTokenHash,
  loyaltyTokenMatches,
  parseLoyaltyCommand,
  readLoyaltyBody,
} from '../lib/loyalty-contract.ts';

const siteId = '11111111-1111-4111-8111-111111111111';

test('ポイント設定と発行入力を整形し、範囲外や余分な型を拒否する', () => {
  assert.deepEqual(parseLoyaltyCommand({ action: 'configure', siteId, maxStamps: 12, reward: ' 特典 ', cardName: ' 会員カード ' }), {
    action: 'configure', siteId, maxStamps: 12, reward: '特典', cardName: '会員カード',
  });
  assert.deepEqual(parseLoyaltyCommand({ action: 'issue', siteId, customerName: ' 齋藤 匠 ', customerPhone: ' 090-0000-0000 ' }), {
    action: 'issue', siteId, customerName: '齋藤 匠', customerPhone: '090-0000-0000',
  });
  assert.throws(() => parseLoyaltyCommand({ action: 'configure', siteId, maxStamps: 0, reward: '特典', cardName: 'カード' }));
  assert.throws(() => parseLoyaltyCommand({ action: 'configure', siteId, maxStamps: 10.5, reward: '特典', cardName: 'カード' }));
  assert.throws(() => parseLoyaltyCommand({ action: 'issue', siteId, customerName: '', customerPhone: '' }));
  assert.throws(() => parseLoyaltyCommand({ action: 'issue', siteId, customerName: 'a'.repeat(101), customerPhone: '' }));
});

test('本文はContent-Lengthが無くても実バイト数で打ち切る', async () => {
  const req = new Request('https://example.test/api/loyalty', {
    method: 'POST', body: JSON.stringify({ customerName: 'あ'.repeat(1000) }),
  });
  await assert.rejects(() => readLoyaltyBody(req, 1000), /長すぎ/);
});

test('公開カードのトークンは生値を保存せず一定時間比較する', () => {
  const token = 'a'.repeat(43);
  const hash = loyaltyTokenHash(token);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(loyaltyTokenMatches(token, hash), true);
  assert.equal(loyaltyTokenMatches('b'.repeat(43), hash), false);
  assert.equal(loyaltyTokenMatches(token, 'broken'), false);
});

test('APIは原子的RPCを使い、DB失敗を成功として返さない', () => {
  const route = fs.readFileSync(new URL('../app/api/loyalty/route.ts', import.meta.url), 'utf8');
  assert.match(route, /rpc\('laruhp_loyalty_configure'/);
  assert.match(route, /rpc\('laruhp_loyalty_add_stamp'/);
  assert.doesNotMatch(route, /card\.stamps \+ 1/);
  assert.match(route, /if \(error \|\| !result\?\.ok/);
  assert.match(route, /public_token_hash: loyaltyTokenHash\(token\)/);
  assert.doesNotMatch(route, /error\.message \}, \{ status: 500/);
});

test('公開カードは新規カードのトークンを必須にし、旧カードでも氏名を表示しない', () => {
  const page = fs.readFileSync(new URL('../app/laruHP/loyalty/card/[id]/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /protectedCard && !mayShowName/);
  assert.match(page, /mayShowName && <div[^>]*>\{card\.customer_name\}/);
  assert.match(page, /robots: \{ index: false, follow: false \}/);
  assert.match(page, /referrer: 'no-referrer'/);
  const route = fs.readFileSync(new URL('../app/api/loyalty/route.ts', import.meta.url), 'utf8');
  assert.match(route, /!validLoyaltyToken\(token\)/);
  assert.match(route, /loyaltyTokenMatches\(token, card\.public_token_hash\)/);
});

test('DB定義はカード表・原子的処理・権限境界を再現可能にする', () => {
  const sql = fs.readFileSync(new URL('../supabase/hp_loyalty.sql', import.meta.url), 'utf8');
  assert.match(sql, /create table if not exists public\.loyalty_cards/);
  assert.match(sql, /public_token_hash text/);
  assert.match(sql, /card_name text not null default 'スタンプカード'/);
  assert.match(sql, /for update of c/);
  assert.match(sql, /set stamps=stamps\+1/);
  assert.match(sql, /jsonb_set\(coalesce\(settings_json/);
  assert.match(sql, /revoke all on public\.loyalty_cards from anon, authenticated/);
  assert.match(sql, /grant execute on function public\.laruhp_loyalty_add_stamp\(uuid,uuid\) to service_role/);
  const runner = fs.readFileSync(new URL('../supabase/run-sql-regression.sh', import.meta.url), 'utf8');
  assert.match(runner, /hp_loyalty\.sql/);
  assert.match(runner, /hp_loyalty_regression\.sql/);
});

test('管理画面は保存・発行・加算の失敗を利用者へ示す', () => {
  const page = fs.readFileSync(new URL('../app/laruHP/loyalty/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /通信できませんでした。入力内容は残っています/);
  assert.match(page, /setStampError\(d\.error \|\| 'ポイントを追加できませんでした'\)/);
  assert.match(page, /role="alert"/);
  assert.doesNotMatch(page, /🎉|⭐/u);
});
