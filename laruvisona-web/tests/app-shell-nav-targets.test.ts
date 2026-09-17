import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { NAV_PRIMARY, NAV_GROUPS, NAV_FOOTER } from '../lib/laruhp-nav';

/**
 * 道しるべに載っている行き先が、開いても道しるべを失わないこと。
 *
 * 2026-09-17、サイドバーの「予約管理」は /laruHP/booking/schedule を指していた。
 * ところがその画面だけ骨組み（AppShell）を着ておらず、
 * **押すとサイドバーが消えた。** 戻る道はブラウザの戻るしかない。
 *
 * 美容室にとって予約は一番よく開く所。そこで道しるべが消える。
 *
 * 骨組みを着せる作業は16画面まとめて回したが、この1枚は
 * `page.tsx` が別のコンポーネントを1行返すだけだったので、
 * **中身を見に行く形になっていて、まとめ作業の網から漏れた。**
 * 漏れるのはいつも、他と形の違う1枚。
 *
 * だから「全画面を見る」ではなく「道しるべの行き先を見る」で確かめる。
 * 載せた以上は着ている、が守れていればよい。
 */

const root = new URL('../', import.meta.url).pathname;
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

/** 道しるべに載っている行き先を、全部集める */
function navTargets(): { href: string; label: string }[] {
  const out = [...NAV_PRIMARY, ...NAV_FOOTER];
  for (const g of NAV_GROUPS) out.push(...g.items);
  return out.map(i => ({ href: i.href, label: i.label }));
}

/** その行き先の page.tsx を探す（[param] は当てはめない・道しるべは固定の道だけ） */
function pageFor(href: string): string | null {
  const rel = href.replace(/^\//, '').split('?')[0];
  for (const ext of ['tsx', 'ts']) {
    const p = path.join(root, 'app', rel, `page.${ext}`);
    if (fs.existsSync(p)) return path.join('app', rel, `page.${ext}`);
  }
  return null;
}

/**
 * その画面が骨組みを着ているか。
 *
 * page.tsx が別の部品を返すだけのことがあるので（予約管理がそれだった）、
 * page.tsx から辿れる自前の部品まで1段見る。注釈の中の AppShell は数えない。
 */
function wearsShell(file: string, depth = 0): boolean {
  const raw = read(file);
  const src = raw
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
  if (/<AppShell[\s>]/.test(src)) return true;
  if (depth >= 2) return false;
  for (const m of src.matchAll(/from ['"](@\/[^'"]+|\.\/[^'"]+)['"]/g)) {
    const spec = m[1];
    const base = spec.startsWith('@/')
      ? spec.slice(2)
      : path.join(path.dirname(file), spec);
    for (const ext of ['.tsx', '.ts']) {
      if (fs.existsSync(path.join(root, base + ext)) && wearsShell(base + ext, depth + 1)) return true;
    }
  }
  return false;
}

test('道しるべの行き先が、すべて実在する', () => {
  const missing = navTargets().filter(t => !pageFor(t.href)).map(t => `${t.label} → ${t.href}`);
  assert.deepEqual(missing, [], '押すと404になる行き先');
});

/**
 * 骨組みを着せない画面。ここに載せるのは「決めてそうしている」もの**だけ**。
 *
 * 全画面の編集画面は、道しるべを畳んで作る所。骨組みを着せると作る場所が狭くなる。
 * そのかわり、自前の戻る道を必ず持つこと（下のテストで見ている）。
 *
 * うっかり漏れた画面をここへ足して通す、はしないこと。
 * 漏れを見つけるための一覧なので、足した時点で意味が無くなる。
 */
const FULLSCREEN_EDITORS = new Set([
  '/laruHP/studio',   // 制作スタジオ
]);

test('道しるべの行き先は、開いても道しるべを失わない', () => {
  const naked: string[] = [];
  for (const t of navTargets()) {
    if (FULLSCREEN_EDITORS.has(t.href)) continue;
    const file = pageFor(t.href);
    if (!file) continue;
    if (!wearsShell(file)) naked.push(`${t.label} → ${t.href}`);
  }
  assert.deepEqual(naked, [], '開くとサイドバーが消える行き先');
});

test('骨組みを着せない画面の一覧が、太らない', () => {
  // ここが増えるのは、たいてい「直すのが面倒だから足した」とき。
  assert.ok(FULLSCREEN_EDITORS.size <= 1, `${FULLSCREEN_EDITORS.size}件に増えている`);
  for (const href of FULLSCREEN_EDITORS) {
    assert.ok(pageFor(href), `${href} が実在しない`);
  }
});

test('見張りが、本当に見つけられること', () => {
  // 1行返すだけの page.tsx でも、中身まで見に行けているか。
  assert.ok(wearsShell('app/laruHP/booking/schedule/page.tsx'), '1段先を見に行けていない');
  // 着ていない画面を、着ていると言わないこと（全画面の編集画面は着ない側）
  assert.ok(!wearsShell('app/laruHP/edit/page.tsx'), '着ていないのに着ていると言う');
});

test('全画面の編集画面は、着ない側のままにする', () => {
  // 制作スタジオ・ビルダー・スマホ編集は、道しるべを畳んで作る画面。
  // ここに骨組みを着せると、作る場所が狭くなる。意図してこうしてある。
  for (const file of [
    'app/laruHP/studio/page.tsx',
    'app/laruHP/builder/page.tsx',
    'app/laruHP/edit/page.tsx',
  ]) {
    assert.ok(!wearsShell(file), `${file} が骨組みを着ている`);
    // ただし戻る道は要る。道しるべが無いぶん、自前で持つこと。
    assert.match(read(file), /laruHP\/dashboard/, `${file} に戻る道が無い`);
  }
});
