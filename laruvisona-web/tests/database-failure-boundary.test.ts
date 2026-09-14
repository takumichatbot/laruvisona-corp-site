import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('予約とショップはDB障害を不存在や決済準備中へ変換しない', () => {
  const link = read('app/api/hp/scheduling/link/route.ts');
  const scheduling = read('app/api/hp/scheduling/route.ts');
  const server = read('lib/scheduling/server.ts');
  const shop = read('app/api/shop/checkout/route.ts');

  assert.match(link, /\.maybeSingle\(\);[\s\S]*if \(error\)[\s\S]*status: 503/);
  assert.match(scheduling, /if \(se\) return fail\(se\);[\s\S]*if \(!site\?\.published\)/);
  assert.match(scheduling, /if\(site\.error\)return fail\(site\.error\);/);
  assert.match(scheduling, /if\(siteError\)return fail\(siteError\);/);
  assert.match(server, /if \(error\)[\s\S]*response: fail\(error\)[\s\S]*if \(!site\)/);
  assert.match(shop, /if \(siteError\)[\s\S]*status: 503/);
});

test('サイト作成・複製・プレビュー発行・外部診断も読取障害と競合を成功にしない', () => {
  const sites = read('app/api/sites/route.ts');
  assert.match(sites, /profileError \|\| !profile[\s\S]*status: 503/);
  assert.doesNotMatch(sites, /error: error\.message/);
  const duplicate = read('app/api/sites/[id]/duplicate/route.ts');
  assert.match(duplicate, /originalError[\s\S]*status: 503/);
  assert.match(duplicate, /profileError \|\| !profile[\s\S]*status: 503/);
  const preview = read('app/api/sites/[id]/preview-token/route.ts');
  assert.match(preview, /for \(let attempt = 0; attempt < 4; attempt\+\+\)/);
  assert.match(preview, /\.eq\('updated_at', site\.updated_at\)[\s\S]*\.select\('id'\)/);
  assert.match(preview, /updated\?\.length === 1/);
  assert.match(preview, /status: 409/);
  assert.doesNotMatch(preview, /error: error\.message/);
  const pagespeed = read('app/api/sites/[id]/pagespeed/route.ts');
  assert.match(pagespeed, /siteError[\s\S]*status: 503/);
});

test('運用画面と破壊的操作はDB障害を権限不足・不存在・空一覧に変換しない', () => {
  const paths = [
    'app/api/account/brand/route.ts',
    'app/api/newsletter/[siteId]/subscribers/route.ts',
    'app/api/newsletter/campaigns/route.ts',
    'app/api/hp/members/manage/route.ts',
    'app/api/sites/[id]/posts/route.ts',
    'app/api/sites/[id]/versions/route.ts',
    'app/api/sites/[id]/versions/[versionId]/route.ts',
    'app/api/sites/[id]/webhook-logs/route.ts',
    'app/api/larubot/conversations/route.ts',
  ];
  for (const path of paths) {
    assert.match(read(path), /(?:site|profile)Error[\s\S]*status: 503/, path);
  }
  const restore = read('app/api/sites/[id]/versions/[versionId]/route.ts');
  assert.match(restore, /\.select\('id'\);[\s\S]*restored\?\.length !== 1/);
  assert.doesNotMatch(restore, /error: error\.message/);
  const logs = read('app/api/sites/[id]/webhook-logs/route.ts');
  assert.match(logs, /if \(rowsError\)[\s\S]*status: 503/);
  const conversations = read('app/api/larubot/conversations/route.ts');
  assert.match(conversations, /if \(memberError[\s\S]*status: 503/);
  assert.match(conversations, /if \(conversationsError\)[\s\S]*status: 503/);
});
