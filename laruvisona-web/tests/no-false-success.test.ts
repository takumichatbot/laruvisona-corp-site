import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { bareSource } from './helpers/bare-source';

/**
 * 「成功しました」と出すなら、成功したことを確かめてから出す。
 *
 * 2026-09-17時点で、画面側にこの形がいくつも残っていた。
 *
 *   await fetch(...);            ← 結果を見ない
 *   setXxx(新しい値);             ← 画面だけ書き換える
 *   showMsg('保存しました');       ← 嘘をつく
 *
 * 黙って失敗するより悪い。店主は保存されたと信じるので、
 * 次に開いて空でも「入力し忘れた」と解釈する。原因にたどり着けない。
 *
 * 押したあと固まる形も同じ根っこ。
 *
 *   setSending(true);
 *   const res = await fetch(...);   ← try の外
 *   const data = await res.json();  ← ここで例外が飛ぶと
 *   setSending(false);              ← ここに一生たどり着かない
 *
 * ボタンは「送信中...」のまま。お客様への返信が出たのかも分からない。
 */

const root = new URL('../', import.meta.url).pathname;
const read = (p: string) => bareSource(fs.readFileSync(path.join(root, p), 'utf8'));

/**
 * その関数の中身だけを切り出す。
 *
 * 「頭から1200文字」で切ると、**隣の関数まで入る。**
 * 片方から確認を外しても、隣のぶんが引っかかって見張りが通ってしまう。
 * 実際そうなっていて、わざと壊しても落ちなかった。
 * 落ちない見張りは、無いのと同じ。
 */
function fnBody(src: string, name: string): string {
  const at = src.indexOf(`const ${name} = async`);
  assert.ok(at > 0, `${name} が見つからない`);
  const rest = src.slice(at + 10);
  const next = rest.search(/\n  (?:const|function|export|\/\*) /);
  return next > 0 ? rest.slice(0, next) : rest;
}

test('お客様への返信は、固まらない', () => {
  const crm = read('app/laruHP/crm/page.tsx');
  const fn = fnBody(crm, 'sendReply');
  assert.match(fn, /\} finally \{\s*setSendingReply\(false\);\s*\}/, '固まる道が残っている');
  assert.match(fn, /res\.json\(\)\.catch\(/, 'JSON以外の応答で落ちる');
  // 送れていないときに、書いた文面まで消さないこと
  const catchAt = fn.indexOf('} catch {');
  assert.doesNotMatch(fn.slice(catchAt, catchAt + 260), /setReplyText\(''\)/, '失敗したのに文面を消している');
});

test('連携の解除は、確かめてから「解除しました」と出す', () => {
  const st = read('app/laruHP/settings/page.tsx');
  const fn = fnBody(st, 'handleIgDisconnectConfirm');
  assert.match(fn, /ok = res\.ok;/, '結果を見ていない');
  assert.match(fn, /if \(!ok\) \{ setIgMsg\('連携を解除できませんでした/, '失敗しても成功表示になる');
});

test('AIの返信案は、作れなかったらそう言う', () => {
  const st = read('app/laruHP/settings/page.tsx');
  const fn = fnBody(st, 'handleReviewReply');
  assert.match(fn, /else setReviewReplyError\(/, '上限やサーバ落ちのときに何も出ない');
  assert.match(fn, /\} finally \{\s*setReviewReplyLoading\(null\);\s*\}/, '固まる道が残っている');
  assert.match(st, /\{reviewReplyError && \(/, '画面に出していない');
});

test('A/Bテストのメモは、保存できたときだけ「保存しました」', () => {
  const ab = read('app/laruHP/ab-test/page.tsx');
  for (const fn of ['handleSaveVariantNotes', 'handleSetTestStart']) {
    const body = fnBody(ab, fn);
    assert.match(body, /if \(!res\.ok\) throw/, `${fn}: 結果を見ていない`);
    assert.match(body, /\} catch \{\s*showMsg\([^)]*'error'\);/, `${fn}: 失敗を伝えていない`);
  }
});

test('運営の操作は、反映を確かめてから画面を変える', () => {
  const ad = read('app/laruHP/admin/page.tsx');
  assert.match(ad, /const patchUser = async \(userId: string, body: Record<string, unknown>\): Promise<boolean>/);
  // 4つの操作が、どれもその一本を通ること
  const calls = (ad.match(/await patchUser\(/g) || []).length;
  assert.ok(calls >= 3, `patchUser を通る操作が${calls}件しかない`);
  // 素の PATCH が残っていないこと（共通処理の中の1つだけが正しい）
  const raw = (ad.match(/await fetch\(`\/api\/admin\/users\/\$\{userId\}`/g) || []).length;
  assert.equal(raw, 1, `素の呼び出しが${raw}箇所ある（共通処理の中の1つだけにする）`);
  assert.match(ad, /\{opError && \(/, '失敗を画面に出していない');
});

test('押したあとの状態は、finally で必ず戻す', () => {
  // catch の中だけで戻すと、途中の return で抜けたときに固まる。
  for (const [file, setters] of [
    ['app/laruHP/admin/page.tsx', ['setSaving(null)', 'setPlanChanging(null)', 'setCanceling(null)']],
    ['app/laruHP/crm/page.tsx', ['setSendingReply(false)']],
  ] as [string, string[]][]) {
    const src = read(file);
    for (const setter of setters) {
      const re = new RegExp(`\\} finally \\{\\s*${setter.replace(/[()]/g, '\\$&')};`);
      assert.match(src, re, `${file}: ${setter} が finally に無い`);
    }
  }
});
