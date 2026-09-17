import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const route = readFileSync(new URL('../app/api/stripe/webhook/route.ts', import.meta.url), 'utf8');

test('契約開始はプロフィールを実際に1件更新してから案内と機能発行へ進む', () => {
  const beforeMail = route.slice(route.indexOf('const profileSaved'), route.indexOf('// サブスク開始メール'));
  assert.match(beforeMail, /\.select\('id'\)/);
  assert.match(beforeMail, /profileSaved\.data\?\.length !== 1/);
});

test('支払い成功・失敗・プラン変更・解約はDB失敗と更新0件を成功にしない', () => {
  /*
    元は `xxx.error || xxx.data?.length !== 1` という書き方そのものを見ていた。
    見たいのは**書き方ではなく決めごと**なので、扱いを見る。

    しかも、その書き方には穴があった。どちらも一律に500を返していたため、
    **profiles に居ない契約**（管理者の契約、Stripe管理画面から直接作った契約）の
    イベントが、何度再送されても永遠に500になる。失敗が積み上がると
    Stripe がこのエンドポイントごと無効にし、**他の全お客様の同期まで止まる。**

    だから2つに分ける。
      書けなかった（error あり） → 500。再送で直る
      1件も当たらない            → 記録に残して200。再送しても当たらない
  */
  assert.match(route, /type WriteOutcome = \{ ok: true \} \| \{ ok: false; retry: boolean; reason: string \}/);
  assert.match(route, /if \(result\.error\) return \{ ok: false, retry: true/);
  assert.match(route, /return \{ ok: false, retry: false/);
  for (const name of ['renewed', 'failedUpdate', 'updatedOutcome']) {
    assert.match(route, new RegExp(`console\\.error\\('\\[Stripe webhook\\]', ${name}\\.reason\\)`), `${name}: 記録に残していない`);
    assert.match(route, new RegExp(`if \\(${name}\\.retry\\) return NextResponse\\.json`), `${name}: 再送に回していない`);
  }
  assert.match(route, /canceled\.error \|\| canceled\.data\?\.length !== 1/);
});

test('解約通知は対象プロフィールの読み取りと状態保存後にだけ送る', () => {
  assert.match(route, /canceledLookup\.error/);
  assert.ok(route.indexOf('const canceled =') < route.indexOf('// 解約メール'));
});

test('契約メールはStripeイベントごとの冪等キーを使い失敗を記録する', () => {
  assert.match(route, /emails\.send\([\s\S]*\{ idempotencyKey \}/);
  for (const kind of ['subscription-start', 'payment-failed', 'plan-changed', 'subscription-canceled']) {
    assert.match(route, new RegExp(`laruhp-${kind}-\\$\\{event\\.id\\}`));
  }
  assert.match(route, /if \(result\.error\)[\s\S]*transactional email rejected/);
  assert.match(route, /transactional email failed/);
  assert.doesNotMatch(route, /catch \{ \/\* non-fatal \*\//);
});
