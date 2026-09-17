import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * コードが読み書きしている表・列が、本番DBに実在するかを見る。
 *
 * 2026-09-17 の点検で、存在しない列を select している箇所が見つかった。
 * PostgREST は存在しない列を含む問い合わせを**丸ごと**失敗させるので、
 *   ・AIサイト診断が何度押しても無反応
 *   ・Googleマップ連携・Instagram連携・エージェンシーのブランド設定が保存できない
 *   ・LARUbotの会話ログが常に空（テーブルごと無かった）
 * という状態になっていた。どれも画面には「何も起きない」としか出ない。
 *
 * 本番DBへ問い合わせるテストは書けないので、列の一覧を写したものを
 * supabase/schema-snapshot.json に置き、それと突き合わせる。
 * **DBに列や表を足したら、その写しも同時に更新すること。**
 */

const root = new URL('../', import.meta.url);
const snapshot = JSON.parse(fs.readFileSync(new URL('supabase/schema-snapshot.json', root), 'utf8')) as {
  tables: Record<string, string[]>;
};

/** 写しに無い＝本番にも無い、とみなす表。社内ツール専用のものはここで除く。 */
const IGNORED_TABLES = new Set([
  'watcher_health', // 社内の監視ツール用。無くても顧客に影響しない
  'ai_commands',    // 同上（社内の操作ログ）
]);

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of fs.readdirSync(new URL(dir, root), { withFileTypes: true })) {
    const next = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.next', 'tests'].includes(entry.name)) continue;
      sourceFiles(next, found);
    } else if (/\.tsx?$/.test(entry.name)) {
      found.push(next);
    }
  }
  return found;
}

const files = [...sourceFiles('app'), ...sourceFiles('lib'), ...sourceFiles('components')];

test('コードが触っている表が、DBに実在する', () => {
  const missing = new Map<string, string>();
  for (const file of files) {
    const src = fs.readFileSync(new URL(file, root), 'utf8');
    for (const m of src.matchAll(/\.from\('([a-z_]+)'\)/g)) {
      const table = m[1];
      if (IGNORED_TABLES.has(table)) continue;
      // auth スキーマや storage は対象外
      if (table.startsWith('auth_') || table === 'objects') continue;
      if (!snapshot.tables[table] && !missing.has(table)) missing.set(table, file);
    }
  }
  assert.deepEqual([...missing.entries()], [], 'DBに無い表を読み書きしている（問い合わせが丸ごと失敗する）');
});

test('select している列が、DBに実在する', () => {
  const problems: string[] = [];
  for (const file of files) {
    const src = fs.readFileSync(new URL(file, root), 'utf8');
    // .from('x')....select('a, b, c') の形だけを見る。
    // テンプレートリテラル・埋め込み・関数呼び出しを含むものは、静的には判断できないので飛ばす。
    for (const m of src.matchAll(/\.from\('([a-z_]+)'\)([\s\S]{0,200}?)\.select\('([^')]*)'\)/g)) {
      const [, table, gap, columns] = m;
      // 同じ Promise.all の中で別の .from(...) を挟んでいる場合は、対応が取れないので飛ばす
      if (gap.includes("from('")) continue;
      if (IGNORED_TABLES.has(table)) continue;
      const known = snapshot.tables[table];
      if (!known) continue; // 表そのものの不足は上のテストで出る
      for (const raw of columns.split(',')) {
        const column = raw.trim().split(':')[0].trim();
        if (!column || column === '*' || column.includes('(') || column.includes('!')) continue;
        if (!known.includes(column)) problems.push(`${file}: ${table}.${column}`);
      }
    }
  }
  assert.deepEqual(problems, [], 'DBに無い列を読んでいる（その問い合わせは必ず失敗する）');
});

test('DBに足した手順が、リポジトリに残っている', () => {
  const sqlFiles = fs.readdirSync(new URL('supabase/', root)).filter(f => f.endsWith('.sql'));
  const all = sqlFiles.map(f => fs.readFileSync(new URL('supabase/' + f, root), 'utf8')).join('\n');
  // 写しに入れた新しい表・列は、SQLの手順も残しておく（別の環境を立てるときに再現できるように）
  assert.ok(snapshot.tables.larubot_conversations, '写しに larubot_conversations が無い');
  assert.match(all, /create table if not exists public\.larubot_conversations/);
  assert.ok(snapshot.tables.profiles.includes('gmb_place_id'));
  assert.match(all, /add column if not exists gmb_place_id/);
  assert.ok(snapshot.tables.news_posts.includes('scheduled_at'));
  assert.match(all, /add column if not exists scheduled_at/);
});
