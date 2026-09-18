import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { submitIndexNow } from '../lib/indexnow.ts';
import { bareSource } from './helpers/bare-source';

/**
 * 公開しても、検索エンジンに何も伝えていなかった。
 *
 * 顧客がサイトを公開しても、見つけてもらえるのは「どこかからリンクされる」か
 * 「クロールが偶然通る」まで。**こちらからは一言も知らせていなかった。**
 *
 * 「検索流入を継続的に獲得」と売っている製品で、公開した瞬間の
 * いちばん最初の一歩が抜けていた。
 *
 * 送る処理自体は前からあったが、`app/api/admin/indexnow` にあり
 *   ・管理者しか叩けない
 *   ・送り先が laruhp.com（自社サイト）に決め打ち
 * だったので、顧客サイトには一度も使えなかった。
 *
 * 気をつけること: 形の違う鍵を送ると、以後その host ごと弾かれることがある。
 * 送る前に形を確かめる。鍵は応答にも記録にも出さない。
 */

const read = (p: string) => bareSource(fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));

test('公開したら、知らせに行く', () => {
  const route = read('app/api/sites/[id]/publish/route.ts');
  assert.match(route, /import \{ submitIndexNow \} from '@\/lib\/indexnow';/);
  assert.match(route, /const sent = await submitIndexNow\(new URL\(canonical\)\.host, \[canonical\]\);/,
    '送っていない');
});

test('送れなくても、公開は成功にする', () => {
  // 外の都合で公開が失敗したら、本末転倒。
  const route = read('app/api/sites/[id]/publish/route.ts');
  const at = route.indexOf('const canonical = canonicalBase(');
  const block = route.slice(at, route.indexOf('return NextResponse.json({', at));
  assert.doesNotMatch(block, /return NextResponse\.json\([^)]*status: 5/, '送信の失敗で公開を落としている');
  assert.doesNotMatch(block, /throw /, '送信の失敗で投げている');
  assert.match(block, /console\.error\('\[publish\] IndexNow へ送れませんでした:'/, '失敗を黙っている');
});

test('独自ドメインは送らない。ただし黙って落とさない', () => {
  /*
    IndexNow は「そのドメインに鍵ファイルがあること」で持ち主を確かめる。
    顧客の独自ドメインにこちらはファイルを置けないので、送れない。
  */
  const route = read('app/api/sites/[id]/publish/route.ts');
  assert.match(route, /if \(site\.custom_domain\) \{/);
  assert.match(route, /indexnow = 'skipped_custom_domain';/);
  assert.match(route, /console\.warn\('\[publish\] 独自ドメインのため IndexNow へ送れません:'/);
});

test('結果を応答に出す（あとから追えるように）', () => {
  const route = read('app/api/sites/[id]/publish/route.ts');
  assert.match(route, /^\s*indexnow,$/m, '送ったかどうかが呼び出し側から見えない');
});

test('鍵の形が違うものは、送らない', async () => {
  // 形の違う鍵を送ると、以後その host が弾かれることがある。
  const lib = fs.readFileSync(new URL('../lib/indexnow.ts', import.meta.url), 'utf8');
  assert.match(lib, /const KEY_SHAPE = \/\^\[A-Za-z0-9-\]\{8,128\}\$\//);
  assert.match(lib, /if \(!KEY_SHAPE\.test\(key\)\) return \{ ok: false, reason: 'key_invalid' \};/);
});

test('送り先と違う host のURLが混ざったら、送らない', async () => {
  // 1つでも混じると、まとめて無効になる。
  const bad = await submitIndexNow('laruvisona.jp', ['https://example.com/hp/a']);
  assert.deepEqual(bad, { ok: false, reason: 'host_mismatch' });
  const none = await submitIndexNow('laruvisona.jp', []);
  assert.deepEqual(none, { ok: false, reason: 'no_urls' });
});

test('例外を投げない', async () => {
  // 呼ぶ側（公開処理）を巻き込まないこと。
  const lib = fs.readFileSync(new URL('../lib/indexnow.ts', import.meta.url), 'utf8');
  assert.match(lib, /\} catch \{\s*return \{ ok: false, reason: 'unreachable' \};/);
  assert.doesNotMatch(lib, /throw /, '投げている');
});

test('鍵を、応答にも記録にも出さない', () => {
  const lib = fs.readFileSync(new URL('../lib/indexnow.ts', import.meta.url), 'utf8');
  // 単語としての key だけを見る。reason: 'key_unreadable' に反応しないように
  // （最初そう書いて、自分のテストが誤検知した）。
  assert.doesNotMatch(lib, /console\.[a-z]+\([^)]*\bkey\b/, '記録に鍵を流している');
  assert.doesNotMatch(lib, /return \{[^}]*\bkey\b/, '応答に鍵を入れている');
  // 送信の本文にだけ入っていること
  assert.match(lib, /body: JSON\.stringify\(\{ host, key, keyLocation:/);
});

test('送る処理を2か所に書かない', () => {
  /*
    以前は管理用の口に直接 fetch が書いてあった。顧客サイト用にもう1つ
    書くと、片方だけ直したときに食い違う。1つに寄せる。
  */
  const admin = read('app/api/admin/indexnow/route.ts');
  assert.match(admin, /const sent = await submitIndexNow\(HOST, urlList\);/);
  assert.doesNotMatch(admin, /api\.indexnow\.org/, '送り先を書き直している');
  assert.doesNotMatch(admin, /indexnow-key\.txt/, '鍵を読み直している');
});
