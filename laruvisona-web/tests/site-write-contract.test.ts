import test from 'node:test';
import assert from 'node:assert/strict';
import { readSiteCreate } from '../lib/site-write-contract.ts';
import { readFileSync } from 'node:fs';

const request = (body: unknown) => new Request('https://example.test/api/sites', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});

test('サイト作成入力は必要な形だけを受け付ける', async () => {
  assert.deepEqual(await readSiteCreate(request({ name: ' 店 ', industry: ' 美容 ', blocks_json: [], seo_json: {}, settings_json: {} })), {
    name: '店', industry: '美容', blocks: [], seo: {}, settings: {},
  });
  await assert.rejects(() => readSiteCreate(request({ name: '店', user_id: 'other' })), /作成できない/);
  await assert.rejects(() => readSiteCreate(request({ name: '', blocks_json: {} })), /サイト名/);
});

test('サイト作成はDBの原子的な上限処理だけを使う', () => {
  const route = readFileSync(new URL('../app/api/sites/route.ts', import.meta.url), 'utf8');
  const duplicate = readFileSync(new URL('../app/api/sites/[id]/duplicate/route.ts', import.meta.url), 'utf8');
  const publish = readFileSync(new URL('../app/api/sites/[id]/publish/route.ts', import.meta.url), 'utf8');
  const sql = readFileSync(new URL('../supabase/hp_sites.sql', import.meta.url), 'utf8');
  assert.match(route, /rpc\('laruhp_create_site'/);
  assert.doesNotMatch(route, /\.from\('sites'\)[\s\S]{0,200}\.insert\(/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /revoke insert on public\.sites from public, anon, authenticated/i);
  assert.match(sql, /revoke all on function[\s\S]+from public,anon,authenticated/i);
  assert.match(duplicate, /rpc\('laruhp_create_site'/);
  assert.doesNotMatch(duplicate, /\.from\('sites'\)[\s\S]{0,200}\.insert\(/);
  assert.match(publish, /createServiceClient\(\)[\s\S]+update\(\{ published: false/);
  assert.match(sql, /new\.published_html is distinct from old\.published_html/);
  assert.match(sql, /laruhp_guard_site_publication_trg/);
  assert.match(sql, /nullif\(current_setting\('request\.jwt\.claims',true\),'\s*'\)::jsonb/);
  const domains = readFileSync(new URL('../supabase/site_domains.sql', import.meta.url), 'utf8');
  assert.match(domains, /nullif\(current_setting\('request\.jwt\.claims', true\), ''\)::jsonb/);
});
