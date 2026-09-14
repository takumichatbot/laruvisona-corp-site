import { createHmac, timingSafeEqual } from 'node:crypto';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function signingSecret(){
  const value=process.env.ANALYTICS_SIGNING_SECRET||process.env.SUPABASE_SERVICE_ROLE_KEY||'';
  if(value.length<32)throw new Error('analytics_unavailable');
  return value;
}
export function signAnalyticsSite(slug:string){return createHmac('sha256',signingSecret()).update(`laruhp-analytics:v1:${slug}`).digest('hex');}
export function verifyAnalyticsSite(slug:string,token:string){
  if(!/^[a-f0-9]{64}$/i.test(token))return false;
  const expected=signAnalyticsSite(slug);return timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(token,'hex'));
}
export async function readAnalyticsJson(req:Request,maxBytes=32768):Promise<unknown>{
  const declared=Number(req.headers.get('content-length')||0);if(declared>maxBytes)throw new Error('body_too_large');
  if(!req.body)return null;
  const reader=req.body.getReader();let size=0;const chunks:Uint8Array[]=[];
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes)throw new Error('body_too_large');chunks.push(value);}}
  finally{reader.releaseLock();}
  return JSON.parse(new TextDecoder().decode(Buffer.concat(chunks)));
}
export function parsePageview(value:unknown){
  if(!value||typeof value!=='object')throw new Error('invalid_input');
  const v=value as Record<string,unknown>;const slug=typeof v.slug==='string'?v.slug.trim():'';const token=typeof v.token==='string'?v.token:'';
  if(!slug||slug.length>160||!verifyAnalyticsSite(slug,token))throw new Error('invalid_input');
  return {slug};
}
export type CleanHeatmapEvent={event_type:'click'|'scroll';x:number|null;y:number|null;scroll_depth:number|null;path:string;viewport_w:number;viewport_h:number;session_id:string};
export type StoredHeatmapEvent={x:number|null;y:number|null;scroll_depth:number|null;viewport_w:number;viewport_h:number;session_id:string|null};
function finiteInt(v:unknown,min:number,max:number){if(typeof v!=='number'||!Number.isFinite(v))throw new Error('invalid_event');const n=Math.round(v);if(n<min||n>max)throw new Error('invalid_event');return n;}
export function parseHeatmapEvents(value:unknown):CleanHeatmapEvent[]{
  if(!Array.isArray(value)||value.length<1||value.length>50)throw new Error('invalid_input');
  return value.map(raw=>{
    if(!raw||typeof raw!=='object')throw new Error('invalid_event');const e=raw as Record<string,unknown>;
    if((e.type!=='click'&&e.type!=='scroll')||typeof e.path!=='string'||!e.path.startsWith('/')||e.path.length>255||!UUID.test(String(e.sessionId||'')))throw new Error('invalid_event');
    if(!e.viewport||typeof e.viewport!=='object')throw new Error('invalid_event');const vp=e.viewport as Record<string,unknown>;
    const viewport_w=finiteInt(vp.w,200,10000),viewport_h=finiteInt(vp.h,200,200000);
    if(e.type==='click')return {event_type:'click' as const,x:finiteInt(e.x,0,10000),y:finiteInt(e.y,0,200000),scroll_depth:null,path:e.path,viewport_w,viewport_h,session_id:String(e.sessionId).toLowerCase()};
    return {event_type:'scroll' as const,x:null,y:null,scroll_depth:finiteInt(e.scrollDepth,0,100),path:e.path,viewport_w,viewport_h,session_id:String(e.sessionId).toLowerCase()};
  });
}
export function analyticsTrackingScript(slug:string,token:string,path='/'){
  if(!path.startsWith('/')||path.length>255)throw new Error('invalid_analytics_path');
  const config=JSON.stringify({slug,token,path}).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
  return `(function(){var C=${config};window.__LHPA={slug:C.slug,token:C.token};var I=(crypto.randomUUID?crypto.randomUUID():([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,function(c){return(c^crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16)})),Q=[],mx=0,h0=Math.max(document.documentElement.scrollHeight,document.body.scrollHeight,innerHeight);Q.push({type:'scroll',scrollDepth:0,path:C.path,viewport:{w:innerWidth,h:h0},sessionId:I});fetch('/api/pageview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(C),keepalive:true}).catch(function(){});function flush(){if(!Q.length)return;var b=Q;Q=[];fetch('/api/heatmap?slug='+encodeURIComponent(C.slug),{method:'POST',headers:{'Content-Type':'application/json','x-laruhp-analytics':C.token},body:JSON.stringify(b),keepalive:true}).catch(function(){Q=b.concat(Q).slice(-50)});}document.addEventListener('click',function(e){var h=Math.max(document.documentElement.scrollHeight,document.body.scrollHeight,innerHeight);Q.push({type:'click',x:e.clientX,y:e.clientY+scrollY,path:C.path,viewport:{w:innerWidth,h:h},sessionId:I});if(Q.length>=25)flush()});addEventListener('scroll',function(){var h=Math.max(document.documentElement.scrollHeight,document.body.scrollHeight,innerHeight),d=Math.round((scrollY/(h-innerHeight||1))*100);if(d>mx){mx=d;Q.push({type:'scroll',scrollDepth:d,path:C.path,viewport:{w:innerWidth,h:h},sessionId:I});if(Q.length>=25)flush()}},{passive:true});addEventListener('pagehide',flush);setInterval(flush,30000)})()`;
}

export function normalizeHeatmapClicks(events:StoredHeatmapEvent[]){
  return events.filter(e=>e.x!==null&&e.y!==null&&e.viewport_w>0&&e.viewport_h>0).map(e=>({
    x:Math.max(0,Math.min(100,Math.round((e.x||0)/e.viewport_w*100))),
    y:Math.max(0,Math.min(100,Math.round((e.y||0)/e.viewport_h*100))),
  }));
}
export function aggregateScrollSessions(events:StoredHeatmapEvent[]){
  const sessions=new Map<string,number>();events.forEach((e,index)=>{if(e.scroll_depth===null)return;const key=e.session_id||`legacy-${index}`;sessions.set(key,Math.max(sessions.get(key)||0,e.scroll_depth));});
  const depths=[...sessions.values()];
  return {total:depths.length,histogram:[0,25,50,75,100].map(depth=>{const count=depths.filter(d=>d>=depth).length;return{depth,count,pct:depths.length?Math.round(count/depths.length*100):0};})};
}
