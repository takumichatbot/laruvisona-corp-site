import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { aggregateScrollSessions,analyticsTrackingScript,normalizeHeatmapClicks,parseHeatmapEvents,parsePageview,readAnalyticsJson,signAnalyticsSite,verifyAnalyticsSite } from '../lib/analytics-contract.ts';

process.env.ANALYTICS_SIGNING_SECRET='a'.repeat(64);
const slug='喫茶-まる',token=signAnalyticsSite(slug),sessionId='11111111-1111-4111-8111-111111111111';

test('計測署名はサイトに結びつき、改ざんと別サイトへの流用を拒否する',()=>{
  assert.equal(verifyAnalyticsSite(slug,token),true);assert.equal(verifyAnalyticsSite('別サイト',token),false);
  assert.deepEqual(parsePageview({slug,token}),{slug});assert.throws(()=>parsePageview({slug,token:token.slice(1)+'0'}));
});

test('分割本文も実バイト上限で止める',async()=>{
  const req=new Request('https://example.test',{method:'POST',body:new ReadableStream({start(c){c.enqueue(new Uint8Array(1500));c.enqueue(new Uint8Array(1500));c.close();}}),duplex:'half'} as RequestInit);
  await assert.rejects(()=>readAnalyticsJson(req,2048),/body_too_large/);
});

test('ヒートマップ入力は座標・画面・パス・セッションを厳密に検査する',()=>{
  const clean=parseHeatmapEvents([{type:'click',x:120,y:900,path:'/menu',viewport:{w:390,h:2400},sessionId},{type:'scroll',scrollDepth:75,path:'/menu',viewport:{w:390,h:2400},sessionId}]);
  assert.equal(clean[0].y,900);assert.equal(clean[1].scroll_depth,75);
  assert.throws(()=>parseHeatmapEvents([{type:'click',x:NaN,y:2,path:'/x',viewport:{w:390,h:800},sessionId}]));
  assert.throws(()=>parseHeatmapEvents([{type:'scroll',scrollDepth:101,path:'/x',viewport:{w:390,h:800},sessionId}]));
  assert.throws(()=>parseHeatmapEvents(Array.from({length:51},()=>({type:'scroll',scrollDepth:1,path:'/',viewport:{w:390,h:800},sessionId}))));
});

test('公開スクリプトはページ全体の縦位置とセッション最大到達率を送る',()=>{
  const script=analyticsTrackingScript(slug,token);assert.match(script,/e\.clientY\+scrollY/);assert.match(script,/documentElement\.scrollHeight/);assert.match(script,/scrollDepth:0/);assert.match(script,/path:C\.path/);assert.match(script,/"path":"\/"/);assert.match(script,/sessionId:I/);assert.match(script,/x-laruhp-analytics/);assert.doesNotMatch(script,/token=/);assert.match(script,/pagehide/);assert.doesNotMatch(script,/beforeunload/);
});

test('クリックはページ全体比率、スクロールは同じ閲覧の最大値を1人として集計する',()=>{
  const base={x:null,y:null,viewport_w:400,viewport_h:2000};
  assert.deepEqual(normalizeHeatmapClicks([{...base,x:200,y:1500,scroll_depth:null,session_id:sessionId}]),[{x:50,y:75}]);
  const result=aggregateScrollSessions([
    {...base,scroll_depth:0,session_id:sessionId},{...base,scroll_depth:25,session_id:sessionId},{...base,scroll_depth:80,session_id:sessionId},
    {...base,scroll_depth:10,session_id:'22222222-2222-4222-8222-222222222222'},
  ]);
  assert.equal(result.total,2);assert.deepEqual(result.histogram.find(x=>x.depth===50),{depth:50,count:1,pct:50});
});

test('APIは署名・公開サイト・端末絞り込み・DB失敗を扱う',()=>{
  const heatmap=fs.readFileSync(new URL('../app/api/heatmap/route.ts',import.meta.url),'utf8');const pageview=fs.readFileSync(new URL('../app/api/pageview/route.ts',import.meta.url),'utf8');
  assert.match(heatmap,/verifyAnalyticsSite/);assert.match(heatmap,/\.eq\('published',true\)/);assert.match(heatmap,/viewport_w',768/);assert.match(heatmap,/result\.error/);assert.match(heatmap,/session_id/);
  assert.match(pageview,/parsePageview/);assert.match(pageview,/result\.error/);assert.match(pageview,/rateLimit/);
});

test('SQLは公開ロールから計測表と加算RPCを閉じる',()=>{
  const sql=fs.readFileSync(new URL('../supabase/hp_analytics.sql',import.meta.url),'utf8');assert.match(sql,/revoke all on public\.heatmap_events from public,anon,authenticated/i);assert.match(sql,/revoke all on function public\.increment_view_count/);assert.match(sql,/session_id uuid/);
});

test('ヒートマップ画面は絵文字を使わず、端末の選択をAPIへ渡す',()=>{
  const page=fs.readFileSync(new URL('../app/laruHP/heatmap/page.tsx',import.meta.url),'utf8');assert.doesNotMatch(page,/📊|🔥|📱|🖥/);assert.match(page,/device=\$\{deviceFilter\}/);
});
