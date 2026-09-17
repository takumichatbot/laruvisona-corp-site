import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const code = (p: string) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');

/**
 * 2026-09-17: 「サブスクリプション管理」を押すと「処理中...」から進まなくなった。
 *
 * 起きていたこと。
 *   1. app/api/stripe/portal が Stripe の例外を捕まえていなかった
 *      → Next が**本文の無い500**を返す（content-type も無い）
 *   2. 画面は `await res.json()` をそのまま呼んでいた
 *      → 例外になり、その下の setPortalLoading(false) まで到達しない
 *   3. try/catch も finally も無いので、ボタンは永久に「処理中」
 *
 * 押した人には理由が何も出ない。サーバー側のログを見るまで誰も気づけない。
 * この形は他のボタンにも伝染しやすいので、ここで固定する。
 */

test('契約管理の口が、Stripeの失敗を本文つきで返す', () => {
  const src = code('app/api/stripe/portal/route.ts');
  assert.match(src, /try\s*\{[\s\S]*billingPortal\.sessions\.create/, 'Stripe呼び出しを捕まえていない');
  assert.match(src, /catch\s*\(\s*err/);
  assert.match(src, /status: 502/, '本文の無い500のままにしない');
  // Stripeの生の文言には顧客IDや設定名が混じる。そのまま返さない。
  assert.doesNotMatch(src, /error:\s*raw\?\.message/);
  assert.doesNotMatch(src, /\{ error: \(err as Error\)\.message \}/);
  // 次に何をすればよいかが分かる連絡先を出す
  assert.match(src, /info@laruvisona\.jp/);
});

test('画面が、応答がJSONでなくても読み込みを解除する', () => {
  for (const path of [
    'app/laruHP/dashboard/DashboardClient.tsx',
    'app/laruHP/settings/page.tsx',
  ]) {
    const src = code(path);
    const start = src.indexOf("fetch('/api/stripe/portal'");
    assert.ok(start > 0, `${path}: 契約管理の呼び出しが無い`);
    const around = src.slice(Math.max(0, start - 600), start + 1400);
    assert.match(around, /finally\s*\{/, `${path}: finally が無い（例外で読み込みが解除されない）`);
    assert.match(around, /res\.json\(\)\.catch\(/, `${path}: 応答がJSONでないと例外になる`);
  }
});

test('押しても何も出ない、にしない', () => {
  // 失敗したことが画面に出ること。黙って戻るのがいちばん悪い。
  const dashboard = code('app/laruHP/dashboard/DashboardClient.tsx');
  assert.match(dashboard, /setPortalError\('通信に失敗しました/);
  const settings = code('app/laruHP/settings/page.tsx');
  assert.match(settings, /setPortalMsg\('通信に失敗しました/);
});
