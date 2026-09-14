import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { googleAccessToken,readSearchConsoleSettings,searchConsoleSites } from '../lib/search-console.ts';

process.env.GOOGLE_CLIENT_ID='client';process.env.GOOGLE_CLIENT_SECRET='secret';
const reply=(status:number,value:unknown)=>async()=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});

test('一時障害を連携解除と誤認せず、invalid_grantだけを失効と判定する',async()=>{
  assert.deepEqual(await googleAccessToken('r',reply(500,{error:'server_error'}) as typeof fetch),{ok:false,revoked:false});
  assert.deepEqual(await googleAccessToken('r',reply(400,{error:'invalid_grant'}) as typeof fetch),{ok:false,revoked:true});
  assert.deepEqual(await googleAccessToken('r',reply(200,{access_token:'access'}) as typeof fetch),{ok:true,token:'access'});
});

test('プロパティ一覧はHTTP失敗と壊れた応答を空一覧に変換しない',async()=>{
  await assert.rejects(()=>searchConsoleSites('a',reply(503,{}) as typeof fetch),/google_unavailable/);
  await assert.rejects(()=>searchConsoleSites('a',reply(200,{siteEntry:[{}]}) as typeof fetch),/google_malformed/);
  assert.deepEqual(await searchConsoleSites('a',reply(200,{siteEntry:[{siteUrl:'sc-domain:example.com'}]}) as typeof fetch),['sc-domain:example.com']);
});

test('保存するプロパティ入力は本文と長さを制限する',async()=>{
  assert.equal(await readSearchConsoleSettings(new Request('https://x.test',{method:'POST',body:JSON.stringify({siteUrl:' https://example.com/ '})})),'https://example.com/');
  await assert.rejects(()=>readSearchConsoleSettings(new Request('https://x.test',{method:'POST',body:JSON.stringify({siteUrl:'x'.repeat(501)})})),/invalid_input/);
});

test('設定APIはGoogleが返した一覧との完全一致と更新件数を確認する',()=>{
  const settings=fs.readFileSync(new URL('../app/api/search-console/settings/route.ts',import.meta.url),'utf8');
  assert.match(settings,/if\(profile\.error\)return NextResponse\.json\(\{error:'Could not load connection'\},\{status:503\}\)/);
  assert.match(settings,/if\(!profile\.data\?\.google_refresh_token\)return NextResponse\.json\(\{error:'Google account is not connected'\},\{status:409\}\)/);
  assert.match(settings,/available\.includes\(siteUrl\)/);assert.match(settings,/saved\.data\?\.length!==1/);assert.match(settings,/readSearchConsoleSettings/);
  const ui=fs.readFileSync(new URL('../app/laruHP/settings/page.tsx',import.meta.url),'utf8');assert.match(ui,/if \(res\.ok\)[\s\S]*setGscConnected\(false\)/);
});

test('データAPIは3応答のHTTP成否を確認し、一時障害でrefresh tokenを消さない',()=>{
  const data=fs.readFileSync(new URL('../app/api/search-console/data/route.ts',import.meta.url),'utf8');
  assert.match(data,/if\(!response\.ok\)throw/);assert.match(data,/if\(access\.revoked\)/);assert.doesNotMatch(data,/if\(!access\.ok\)\{\s*const cleared/);
  assert.match(data,/availableSites\.includes\(siteUrl\)/);assert.match(data,/AbortSignal\.timeout/);
  const callback=fs.readFileSync(new URL('../app/api/auth/google/callback/route.ts',import.meta.url),'utf8');assert.match(callback,/updated\?\.length !== 1/);
});
