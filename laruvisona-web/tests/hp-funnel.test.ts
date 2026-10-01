import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hpFunnel } from '../lib/hp-funnel.ts';

const row = (u: string, created: string, updated: string, published = false, slug: string | null = null) =>
  ({ user_id: u, published, created_at: created, updated_at: updated, slug, custom_domain: null });

test('集計: 社内のサイトを除き、作成月（日本時間）ごとに作成・編集・公開を数える', () => {
  const got = hpFunnel([
    row('a', '2026-06-30T16:00:00Z', '2026-06-30T16:10:00Z'),            // 日本時間 7/1・作ってそのまま
    row('a', '2026-06-10T00:00:00Z', '2026-06-12T00:00:00Z', true, 'a'), // 編集して公開
    row('admin', '2026-06-10T00:00:00Z', '2026-06-20T00:00:00Z', true),  // 社内
  ], new Set(['admin']));
  assert.equal(got.excluded_internal_sites, 1);
  assert.deepEqual(got.by_month['2026-07'], { created: 1, edited: 0, slug: 0, domain: 0, published: 0 });
  assert.deepEqual(got.by_month['2026-06'], { created: 1, edited: 1, slug: 1, domain: 0, published: 1 });
  assert.equal(got.users_with_site, 1);
  assert.equal(got.users_with_published_site, 1);
});

test('集計の口: 管理者だけ・名前やメールを返さない', () => {
  const src = readFileSync('app/api/admin/funnel/route.ts', 'utf8');
  assert.match(src, /if \(!await isAdmin\(supabase\)\) return NextResponse\.json\(\{ error: 'Forbidden' \}, \{ status: 403 \}\)/);
  assert.match(src, /select\('user_id, published, created_at, updated_at, slug, custom_domain'\)/);
  assert.doesNotMatch(src, /email:|name,|blocks_json|published_html/);
});
