import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bareSource } from './helpers/bare-source';

/**
 * 開いただけでは「未保存」にしない。
 *
 * 2026-09-17、本番でビルダーを開き、**何も触らずに**上の帯を見たら
 * 「未保存」と出ていた。そのまま閉じようとすると、ブラウザの
 * 「このサイトを離れますか？」が出る。何も直していないのに。
 *
 * 中身はサーバや下書きから**あとから**入る。その入れ替えが
 * 「編集された」と数えられていた。開けば必ずそうなる。
 *
 * 起きていたこと。
 *   ・見ただけで閉じると警告が出る。消えるのかと思って手が止まる。
 *   ・30秒後に、何も変えていない内容が毎回サーバへ送られる。
 *   ・「未保存」が出っぱなしになり、**本当に未保存のときと見分けがつかない。**
 *     いつも点いている札は、何も知らせていないのと同じ。
 *
 * この画面は、7件中6件が下書きのまま止まっている画面でもある。
 * 「閉じたら消えるかもしれない」と思わせるのは、いちばんやってはいけない。
 */

const read = (p: string) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const builder = read('app/laruHP/builder/page.tsx');

const bare = bareSource(builder);

test('読み込みは、編集として数えない', () => {
  assert.match(bare, /const hydratingRef = useRef\(false\);/);
  assert.match(bare, /if \(hydratingRef\.current\) \{ hydratingRef\.current = false; return; \}/);
  // 印を立てる側と、見る側が、同じ関数を通ること
  assert.match(bare, /const hydrateSite = useCallback\(\(next: SiteData\) => \{\s*hydratingRef\.current = true;\s*setSite\(next\);/);
});

test('読み込みの入り口が、全部そこを通る', () => {
  // 1つでも素の setSite が残っていると、その経路だけ「未保存」になる。
  // 経路は4つ: サーバから / オンボーディングから / 下書き(新)から / 下書き(旧)から
  const entries = [
    /hydrateSite\(\{\s*siteName: s\.name,/,          // サーバから
    /hydrateSite\(\{\s*siteName: d\.businessName/,   // オンボーディングから
    /hydrateSite\(parsed as SiteData\);/,            // 下書き（新しい形）
    /hydrateSite\(\{\s*siteName: parsed\.siteName/,  // 下書き（古い形）
  ];
  for (const re of entries) assert.match(bare, re, `読み込みの入り口が hydrateSite を通っていない: ${re}`);
  assert.equal((bare.match(/hydrateSite\(/g) || []).length, 4, '読み込みの入り口が4つでなくなっている');
});

test('丸ごと差し替える所が、ほかに増えていない', () => {
  // setSite(prev => ...) は部分的な編集。丸ごと差し替えるのは
  //   ・hydrateSite の中（読み込み）
  //   ・元に戻す / やり直す（これは編集なので、数えてよい）
  // の3つだけ。ここが増えたら、新しい読み込み経路が素で入った疑いがある。
  const whole = [...bare.matchAll(/setSite\((?!prev)([^)]*)\)/g)].map(m => m[1].trim());
  assert.deepEqual(whole.sort(), ['next', 'next', 'past'], `丸ごと差し替えが増えている: ${whole.join(' / ')}`);
});

test('印は、1回きりで戻る', () => {
  // 立てっぱなしにすると、**本当の編集まで数えなくなる。**
  // 開いて直して閉じた人の編集が、静かに消える。こちらのほうが怖い。
  const at = bare.indexOf('if (hydratingRef.current)');
  assert.ok(at > 0);
  assert.match(bare.slice(at, at + 90), /hydratingRef\.current = false/, '印を戻していない');
});

test('本当の編集は、これまでどおり数える', () => {
  // 直しついでに、編集の検知そのものを殺していないこと。
  assert.match(bare, /editSeqRef\.current \+= 1;\s*setIsDirty\(true\);/);
  assert.match(bare, /const handler = \(e: BeforeUnloadEvent\) => \{\s*if \(!isDirty\) return;/);
});
