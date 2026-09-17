import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { bareSource } from './helpers/bare-source';

/**
 * 画面が「読み込み中…」のまま永久に止まらないこと。
 *
 * 2026-09-17時点で、ログイン後の5画面（ブログ・ポップアップ・ポイントカード・
 * メール・カレンダー）が同じ形をしていた。
 *
 *   useEffect(() => { (async () => {
 *     const res = await fetch('/api/sites');
 *     const d = await res.json();
 *     ...
 *     setLoading(false);      ← **成功したときだけ**
 *   })(); }, []);
 *
 * 通信が落ちると、そこで止まって setLoading(false) に届かない。
 * 画面は「読み込み中…」のまま、理由も再試行の導線も出ない。
 * 店主にできるのは、閉じることだけ。そして二度と開かない。
 *
 * 開発中は回線が落ちないので、この道はいつも通る。だから気づかれない。
 */

const root = new URL('../', import.meta.url).pathname;
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

/** app/ 配下の画面（"use client"）を全部拾う */
function clientScreens(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) { if (e.name !== 'api') walk(rel); continue; }
      if (!e.name.endsWith('.tsx')) continue;
      const src = read(rel);
      if (/^['"]use client['"]/m.test(src)) out.push(rel);
    }
  };
  walk('app');
  return out;
}

/** 開いた直後に走る読み込み（useEffect の中の即時 async）を取り出す */
function initialLoaders(src: string): string[] {
  return [...src.matchAll(/useEffect\(\(\) => \{\s*\(async \(\) => \{([\s\S]*?)\}\)\(\);/g)].map(m => m[1]);
}

test('開いた直後の読み込みは、失敗しても読み込み中を解く', () => {
  const stuck: string[] = [];
  for (const file of clientScreens()) {
    for (const body of initialLoaders(bareSource(read(file)))) {
      if (!/await fetch/.test(body)) continue;
      if (!/setLoading\(false\)|setLoad\w*\(false\)/.test(body)) continue;
      // catch も finally も無ければ、失敗したときに解けない
      if (!/\bcatch\b/.test(body)) stuck.push(file);
    }
  }
  assert.deepEqual([...new Set(stuck)], [], '失敗すると「読み込み中」のまま止まる画面');
});

test('直した5画面は、finally で必ず解く', () => {
  // catch の中だけで解くと、途中の return で抜けたときに残る。
  for (const file of [
    'app/laruHP/blog/page.tsx',
    'app/laruHP/popups/page.tsx',
    'app/laruHP/loyalty/page.tsx',
    'app/laruHP/newsletter/page.tsx',
    'app/laruHP/calendar/page.tsx',
  ]) {
    const src = bareSource(read(file));
    assert.match(src, /\} finally \{\s*setLoading\(false\);\s*\}/, `${file}: finally で解いていない`);
  }
});

test('止まった理由と、やり直す道を出す', () => {
  for (const file of [
    'app/laruHP/blog/page.tsx',
    'app/laruHP/popups/page.tsx',
    'app/laruHP/loyalty/page.tsx',
    'app/laruHP/newsletter/page.tsx',
    'app/laruHP/calendar/page.tsx',
  ]) {
    const src = bareSource(read(file));
    assert.match(src, /setLoadError\('読み込めませんでした/, `${file}: 理由を出していない`);
    assert.match(src, /\{loadError && \(/, `${file}: 画面に出していない`);
    assert.match(src, /再読み込み/, `${file}: やり直す道が無い`);
    assert.match(src, /role="alert"/, `${file}: 読み上げに乗らない`);
  }
});

test('応答が失敗でも「サイトがありません」と言わない', () => {
  // d.sites || [] だと、503でも空の一覧になり、「まだ作っていない人」と同じ画面になる。
  for (const file of [
    'app/laruHP/blog/page.tsx',
    'app/laruHP/popups/page.tsx',
    'app/laruHP/loyalty/page.tsx',
    'app/laruHP/newsletter/page.tsx',
    'app/laruHP/calendar/page.tsx',
  ]) {
    const src = bareSource(read(file));
    const at = src.indexOf("await fetch('/api/sites')");
    assert.ok(at > 0, `${file}: 一覧の読み込みが無い`);
    // 確かめ方は問わない。投げても、その場で理由を出してもよい。
    // 見たいのは「res.ok を見ずに d.sites || [] へ進んでいないこと」だけ。
    assert.match(src.slice(at, at + 260), /if \(!res\.ok\)/, `${file}: 応答を確かめずに一覧を組み立てている`);
  }
});
