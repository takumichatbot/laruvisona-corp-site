import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readAiJson, requireAiAccess } from '../lib/ai-access.ts';

function db(profile:unknown,rpc:{data:unknown;error:unknown}){
  return {
    from:()=>({select:()=>({eq:()=>({single:async()=>({data:profile,error:null})})})}),
    rpc:async()=>rpc,
  } as unknown as SupabaseClient;
}

test('AIは有効契約とDB共有の利用枠を両方満たす場合だけ使える',async()=>{
  assert.equal(await requireAiAccess(db({plan:'hp',subscription_status:'active'},{data:true,error:null}),'u','assistant',30),null);
  assert.equal((await requireAiAccess(db({plan:'hp',subscription_status:'inactive'},{data:true,error:null}),'u','assistant',30))?.status,403);
  assert.equal((await requireAiAccess(db({plan:'hp',subscription_status:'active'},{data:false,error:null}),'u','assistant',30))?.status,429);
  assert.equal((await requireAiAccess(db({plan:'hp',subscription_status:'active'},{data:null,error:{message:'missing'}}),'u','assistant',30))?.status,503);
});

test('AI入力は実バイト上限とJSONオブジェクト形を確認する',async()=>{
  assert.equal((await readAiJson(new Request('https://example.test',{method:'POST',body:'x'.repeat(20)}),10)).ok,false);
  assert.equal((await readAiJson(new Request('https://example.test',{method:'POST',body:'[]'}))).ok,false);
  const parsed=await readAiJson(new Request('https://example.test',{method:'POST',body:'{"message":"ok"}'}));
  assert.equal(parsed.ok&&parsed.data.message,'ok');
  const stream=new ReadableStream<Uint8Array>({start(c){c.enqueue(new TextEncoder().encode('{"message":"'));c.enqueue(new TextEncoder().encode('長'.repeat(20)));c.close();}});
  const chunked=new Request('https://example.test',{method:'POST',body:stream,duplex:'half'} as RequestInit&{duplex:string});
  const limited=await readAiJson(chunked,20);
  assert.equal(limited.ok,false);
  assert.equal(!limited.ok&&limited.response.status,413);
});

test('外部AIを呼ぶ利用者APIは共有利用枠を通る',()=>{
  const root=new URL('../app/api/ai/',import.meta.url);
  const routes=['blog-generate','chat-analysis','chat-edit','copy','generate','generate-site','image','layout','lead-score','review-reply','scan-url','section-proposal','site-audit','site-images','summarize','translate'];
  for(const name of routes){
    const source=readFileSync(new URL(name+'/route.ts',root),'utf8');
    assert.match(source,/requireAiAccess\(/,name);
    assert.match(source,/readAiJson\(req,/,name);
    assert.doesNotMatch(source,/req\.json\(\)|req\.text\(\)/,name);
  }
});

test('高コスト分析の個別上限もDB共有で数える',()=>{
  for(const name of ['chat-analysis','lead-score']){
    const source=readFileSync(new URL(`../app/api/ai/${name}/route.ts`,import.meta.url),'utf8');
    assert.match(source,/claimBuilderUsage\(supabase,'(?:chat-analysis|lead-score)',5\)/);
    assert.doesNotMatch(source,/new Map<|check(?:ChatAnalysis|LeadScore)Rate/);
  }
});

test('AI利用枠はDBの一意な時間枠で原子的に加算し公開ロールから閉じる',()=>{
  const sql=readFileSync(new URL('../supabase/hp_ai_usage.sql',import.meta.url),'utf8');
  assert.match(sql,/primary key\(user_id,scope,window_start\)/i);
  assert.match(sql,/on conflict\s*\(user_id,scope,window_start\) do update/i);
  assert.match(sql,/where hp_ai_usage\.used<p_limit/i);
  assert.match(sql,/revoke all on public\.hp_ai_usage from public,anon,authenticated/i);
});

test('素材ライブラリ欠落時に利用者単位の画像を自動生成しない',()=>{
  const source=readFileSync(new URL('../app/api/ai/site-images/route.ts',import.meta.url),'utf8');
  assert.doesNotMatch(source,/generateLive|generateImagenToStorage/);
  const publicSource=readFileSync(new URL('../app/api/library-image/route.ts',import.meta.url),'utf8');
  assert.doesNotMatch(publicSource,/generateImagenToStorage|getGeminiKey|inflight/);
  assert.match(publicSource,/status: 404/);
});
