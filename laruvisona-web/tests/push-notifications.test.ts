import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const route = readFileSync(new URL('../app/api/pwa/route.ts', import.meta.url), 'utf8');
const client = readFileSync(new URL('../components/PwaInit.tsx', import.meta.url), 'utf8');
const sender = readFileSync(new URL('../lib/push-notification.ts', import.meta.url), 'utf8');
const worker = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
const schema = readFileSync(new URL('../supabase/hp_push_subscriptions.sql', import.meta.url), 'utf8');

test('購読は利用者ごとの複数端末として保存しDB失敗を返す', () => {
  assert.match(route, /hp_push_subscriptions/);
  assert.match(route, /onConflict: 'user_id,endpoint'/);
  assert.match(route, /endpoint\.protocol !== 'https:'/);
  assert.match(route, /Subscription storage unavailable/);
  assert.match(schema, /unique\(user_id,endpoint\)/);
  assert.match(schema, /user_id=auth\.uid\(\)/);
});

test('ブラウザ購読は保存成功後だけ有効になり解除もDBと端末の双方へ反映する', () => {
  assert.match(client, /if \(!response\.ok\)/);
  assert.match(client, /await sub\.unsubscribe/);
  assert.match(client, /method: 'DELETE'/);
  assert.match(client, /getSubscription\(\)/);
});

test('無効な購読先を除外しLARU HPの正しい画面を開く', () => {
  assert.match(sender, /status === 404 \|\| status === 410/);
  assert.match(sender, /disabled_at/);
  assert.match(worker, /data\.title \|\| 'LARU HP'/);
  assert.match(worker, /data\.url \|\| '\/laruHP\/dashboard'/);
  assert.match(worker, /match\.navigate\(url\)/);
  assert.doesNotMatch(worker, /data\.title \|\| 'Bridge'/);
});

test('問い合わせ・予約・注文の実イベントから端末通知を送る', () => {
  for (const path of ['../app/api/contact/route.ts','../lib/scheduling/notify.ts','../lib/shop-notification.ts']) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.match(source, /sendUserPush\(/);
  }
});
