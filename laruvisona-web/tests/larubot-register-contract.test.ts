import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isBotPlan, LarubotRegisterError } from '../lib/larubot-provision';

const code = (p: string) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const provision = code('lib/larubot-provision.ts');

/**
 * LARUbot 側からの回答（docs/larubot-reply-2026-09-17.md）を受けて直したこと。
 *
 * いちばん重かったのは、認証ヘッダーの名前の食い違い。
 *   こちら: x-laru-secret / 向こう（修正前）: X-LARU-HP-Secret
 * 名前が違えばヘッダーは見つからないので、向こうは401で黙って弾いていた。
 * こちらは応答本文を捨ててステータスしか見ておらず、決済も止めないので、
 * 「課金は通ったのにボットが作られない」が両側のどこにも出なかった。
 * 向こうは両方の名前を受けるようにしたので、こちらの送り方は変えていない。
 */

test('エージェンシー契約を、別のプラン名に化かして送らない', () => {
  // hp-bot に変換して送っていたが、向こうでは hp-bot に LARUSEO が付かない。
  // 全機能込みとして売っているのに、付いていなかった。
  assert.ok(!provision.includes("plan === 'agency' ? 'hp-bot'"), 'agency を hp-bot に変換している');
  assert.match(provision, /\/\/ agency はそのまま送る/);
  assert.ok(isBotPlan('agency'));
});

test('site_id が無いときは、キーごと送らない', () => {
  // 空文字を送ると、向こうがそれをこちらの webhook へ転送し、
  // こちらが「invalid site_id」で400にして、何も紐付かない。
  assert.ok(!provision.includes("site_id: siteId || ''"), '空文字を送っている');
  assert.match(provision, /\.\.\.\(siteId \? \{ site_id: siteId \} : \{\}\)/);
});

test('応答の本文を読み、その場で public_id を書き込む', () => {
  // public_id は最初から応答に入っていた。本文を捨てていたので、
  // コールバックが落ちると永久に紐付かなかった。
  assert.ok(!provision.includes('await res.body?.cancel()'), '本文を捨てている');
  assert.match(provision, /await res\.json\(\)\.catch/);
  assert.match(provision, /larubot_public_id/);
  assert.match(provision, /laruseo_public_id/);
  assert.match(provision, /linkLarubotIds/, '受け取った値を書き込んでいない');
});

test('失敗の理由を、機械で判定できる形で渡す', () => {
  // 画面に一律「登録に失敗しました」としか出せなかった。
  assert.match(provision, /class LarubotRegisterError/);
  assert.match(provision, /payload\?\.code/);
  const err = new LarubotRegisterError('x', 'invalid_plan', 400);
  assert.equal(err.code, 'invalid_plan');
  assert.equal(err.httpStatus, 400);
});

test('受け取った public_id を、そのまま信じない', () => {
  // よそから来た文字列をそのまま設置タグへ入れない
  assert.match(provision, /PUBLIC_ID\s*=\s*\/\^\[A-Za-z0-9_-\]/);
  assert.match(provision, /PUBLIC_ID\.test\(value\)/);
});

test('無い上限を売らない（設置ボット数）', () => {
  // LARUbot 側に「設置ボット数」の上限は存在しない。
  // 1アカウント=1ボットで、設置タグは何サイトに貼っても動く。
  // 2体/3体 は「チャット内のメニュー項目数」の数字だった。
  for (const path of ['app/laruHP/plans/page.tsx', 'app/laruHP/dashboard/DashboardClient.tsx']) {
    // 覚え書きの行は対象外。売っている文（label / desc）だけを見る。
    const src = code(path).split('\n').filter(line => !line.trim().startsWith('//')).join('\n');
    assert.ok(!src.includes('設置ボット数'), `${path}: 存在しない上限を売っている`);
    assert.ok(!/ボット\d体/.test(src), `${path}: ボットの体数で売っている`);
  }
  assert.match(code('app/laruHP/plans/page.tsx'), /チャット内のメニュー項目/);
});
