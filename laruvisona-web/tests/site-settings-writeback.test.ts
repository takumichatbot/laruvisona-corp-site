import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 設定を「丸ごと書き戻す」画面が、もう無いこと。
 *
 * サイトの設定は一つの塊（settings_json）に入っている。
 * 通知先も、検索避けも、プレビュー用URLも、LARUbotの番号も、同じ塊。
 *
 * 画面を開いたときにその塊を読み、保存のときにそのまま送り返すと、
 * **開いてから保存するまでの間に別の場所で変わった分が、前の値に戻る。**
 *
 *   ・パソコンで止めたプレビュー用URLが、また見られるようになる
 *   ・別の画面で変えた問い合わせの通知先が、古いアドレスに戻る
 *   ・検索避け（noIndex）の切り替えが、元に戻る
 *   ・その間にLARUbotの設置が終わっていたら、番号ごと消える
 *
 * どれも画面には何も出ない。店主は文章を直しただけのつもりでいる。
 *
 * 2026-09-17時点で、制作スタジオとビルダーは settings_json_patch に
 * 直してあったが、**スマホの編集画面だけが取り残されていた。**
 * 直した所より、直し忘れた所のほうが危ない。ここで全部を見る。
 */

const root = new URL('../', import.meta.url).pathname;
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

/** 注釈を落としたコード。決めごとを注釈にも書くので、探すのは外だけにする。 */
const bare = (src: string) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n');

/** app/ 配下の画面（"use client"）を全部拾う */
function clientScreens(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) { if (e.name !== 'api') walk(rel); continue; }
      if (!/\.tsx?$/.test(e.name)) continue;
      const src = read(rel);
      if (/^['"]use client['"]/m.test(src)) out.push(rel);
    }
  };
  walk('app');
  walk('components');
  return out;
}

/**
 * 送信の本文だけを取り出す。
 *
 * 画面の中の settings_json をそのまま探すと、**画面側の控え**まで拾ってしまう。
 *   setSites(prev => ... { ...s, settings_json: { ...s.settings_json, x } })
 * これは自分の画面に持っている写しを直しているだけで、送ってはいない。
 * 危ないのは「送る側」だけなので、JSON.stringify( ... ) の中だけを見る。
 */
function requestBodies(src: string): { method: string; body: string }[] {
  const out: { method: string; body: string }[] = [];
  const marker = 'JSON.stringify(';
  for (let i = src.indexOf(marker); i >= 0; i = src.indexOf(marker, i + 1)) {
    let depth = 0, end = -1;
    for (let j = i + marker.length - 1; j < src.length; j++) {
      if (src[j] === '(') depth++;
      else if (src[j] === ')') { depth--; if (depth === 0) { end = j; break; } }
    }
    if (end < 0) continue;
    const body = src.slice(i, end);
    // 同じ fetch の中の method を探す（本文の前後どちらにも書かれる）
    const around = src.slice(Math.max(0, i - 400), Math.min(src.length, end + 400));
    const m = around.match(/method:\s*['"](GET|POST|PUT|PATCH|DELETE)['"]/);
    out.push({ method: m ? m[1] : 'POST', body });
  }
  return out;
}

test('画面は、既にあるサイトへ settings_json を丸ごと送らない', () => {
  const offenders: string[] = [];
  for (const file of clientScreens()) {
    for (const { method, body } of requestBodies(bare(read(file)))) {
      // 作成（POST）だけは、重ねる相手がまだ無いので丸ごとでよい。
      if (method !== 'PUT' && method !== 'PATCH') continue;
      if (/\bsettings_json\s*:/.test(body)) offenders.push(`${file}: ${method}`);
    }
  }
  assert.deepEqual(offenders, [], '設定を丸ごと書き戻している画面');
});

test('見張りが、本当に見つけられること', () => {
  // 検出そのものが壊れていないか、わざと悪い形を食わせて確かめる。
  const bad = `fetch(\`/api/sites/\${id}\`, { method: 'PUT', body: JSON.stringify({ settings_json: s }) })`;
  assert.equal(requestBodies(bad).filter(r => r.method === 'PUT' && /settings_json\s*:/.test(r.body)).length, 1);
  // 画面側の控えは拾わない
  const ok = `setSites(prev => prev.map(s => ({ ...s, settings_json: { ...s.settings_json, x: 1 } })));`;
  assert.equal(requestBodies(ok).length, 0);
});

test('スマホの編集画面は、触った所だけ送る', () => {
  const src = bare(read('app/laruHP/edit/page.tsx'));
  // 文章の書き換えと並べ替えしかしない画面。送るのは blocks_json だけ。
  assert.match(src, /body: JSON\.stringify\(\{ blocks_json: \{ v: 2, pages \} \}\)/);
  assert.doesNotMatch(src, /settings_json/, '設定を送っている');
  assert.doesNotMatch(src, /seo_json/, '検索設定を送っている');
  // 保存と公開で、送るものが食い違わないこと（以前は同じ本文を2箇所に書いていた）
  const bodies = src.match(/body: JSON\.stringify\(\{[^)]*blocks_json/g) || [];
  assert.equal(bodies.length, 1, `保存の本文が${bodies.length}箇所にある`);
});

test('受け口は、届かなかった項目を消さない', () => {
  // 「送らなければ残る」が、この直しの土台。ここが変わると全部崩れる。
  const api = bare(read('app/api/sites/[id]/route.ts'));
  for (const key of ['name', 'blocks_json', 'seo_json']) {
    assert.match(api, new RegExp(`if \\(${key.replace(/[[\]]/g, '')} !== undefined\\) update\\.${key} = ${key};`),
      `${key} が undefined のときに書きに行っている`);
  }
  assert.match(api, /if \(settings_json !== undefined\) update\.settings_json = settings_json;/);
});

test('制作スタジオとビルダーは、重ねる形のまま', () => {
  // 一度直した所が戻っていないか、ついでに見る。
  for (const file of ['app/laruHP/studio/page.tsx', 'app/laruHP/builder/page.tsx']) {
    assert.match(bare(read(file)), /settings_json_patch/, `${file} が重ねる形でなくなっている`);
  }
});
