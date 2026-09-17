import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bareSource } from './helpers/bare-source';

/**
 * サーバ側の「できたか分からないまま、できたことにする」を潰す。
 *
 * どれも同じ形。外への送信やDBへの書き込みの結果を見ず、
 * ログにも状態にも残さない。**後から調べる手段が存在しない。**
 * 「送ったが失敗した」と「そもそも送っていない」が区別できない。
 */

const read = (p: string) => bareSource(fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));

test('翻訳は、保存できたときだけ「できました」と答える', () => {
  // 店主はお金と時間を使って翻訳する。保存に失敗すると、翌日には無い。
  // 画面側は成功前提で手元の控えを先に書き換えるので、リロードするまで気づけない。
  const src = read('app/api/ai/translate/route.ts');
  assert.match(src, /const saved = await supabase\.from\('sites'\)\.update/);
  assert.match(src, /if \(saved\.error\) \{/);
  assert.match(src, /status: 503/);
});

test('配信状況の書き込みは、失敗を再送に回す', () => {
  // 書けていないのに200を返すと、Resendは再送しない。
  // 問い合わせ一覧は「受け付けました」のまま永久に止まる。
  // いちばん困るのは bounced のとき。店主は返事を待ち続ける。
  const src = read('app/api/resend/webhook/route.ts');
  assert.match(src, /Promise<'recorded' \| 'not-a-contact' \| 'write-failed'>/);
  assert.match(src, /if \(result === 'write-failed'\) \{[\s\S]{0,180}status: 500/);
  // 書けなかったときに、本当に write-failed を返していること。
  // 型と分岐だけ見ても、中で別の値を返していれば意味が無い。
  const at = src.indexOf('if (saved.error) {');
  assert.ok(at > 0, '書き込みの失敗を見ていない');
  const branch = src.slice(at, src.indexOf('}', src.indexOf('return', at)));
  assert.match(branch, /return 'write-failed';/, `失敗したときの返し方が違う: ${branch.slice(0, 200)}`);
  // 「この受付ではなかった」と「書けなかった」を同じ値で返さないこと
  assert.doesNotMatch(src, /\): Promise<boolean> \{[\s\S]{0,400}extra_fields->>/);
});

test('登録直後のメールは、送れたかを記録に残す', () => {
  const src = read('app/api/auth/callback/route.ts');
  assert.match(src, /if \(welcome\.error\) \{\s*console\.error/);
  // 印を付け損ねると、次のログインで同じメールをもう一度送る
  assert.match(src, /welcome_sent not recorded \(may resend\)/);
  assert.doesNotMatch(src, /\} catch \{\s*\}/, '黙って握りつぶす所が残っている');
});

test('運営のプラン変更メールは、拒否を記録に残す', () => {
  // Resend は拒否されても throw しない。戻り値を捨てると調べようがない。
  const src = read('app/api/admin/users/[id]/route.ts');
  assert.match(src, /const notice = await resend\.emails\.send\(/);
  assert.match(src, /if \(notice\.error\) console\.error/);
});

test('Macへの送信は、送れなければ消さずに次へ回す', () => {
  const src = read('app/api/bridge/quick/route.ts');
  assert.match(src, /function safeSendToMac\(mac: MacEntry, data: object\): boolean/);
  assert.match(src, /if \(safeSendToMac\(target, \{ type: 'message', content: task\.input \}\)\) \{/);
  // 送れていないのに「送信しました」と答える道が残っていないこと
  const at = src.indexOf("mode: 'immediate'");
  assert.ok(at > 0);
  assert.match(src.slice(Math.max(0, at - 320), at), /if \(safeSendToMac\(/, '送れたか見ずに答えている');
});

test('握りつぶす catch が、この5ファイルに残っていない', () => {
  // ここで潰した型そのもの。戻ってきていないか見る。
  for (const file of [
    'app/api/ai/translate/route.ts',
    'app/api/resend/webhook/route.ts',
    'app/api/auth/callback/route.ts',
    'app/api/admin/users/[id]/route.ts',
    'app/api/bridge/quick/route.ts',
  ]) {
    const src = read(file);
    assert.doesNotMatch(src, /catch \{\s*\}/, `${file}: 空の catch がある`);
    assert.doesNotMatch(src, /\.catch\(\(\) => \{\}\)/, `${file}: 握りつぶしている`);
  }
});
