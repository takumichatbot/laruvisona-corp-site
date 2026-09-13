import { NextResponse } from 'next/server';
import { createClient,createServiceClient } from '@/lib/supabase/server';
import { aggregateScrollSessions,normalizeHeatmapClicks,parseHeatmapEvents,readAnalyticsJson,verifyAnalyticsSite } from '@/lib/analytics-contract';
import { clientIp } from '@/lib/rate-limit';
import { claimPublicRate } from '@/lib/public-rate-limit';

export async function POST(req:Request){
  const {searchParams}=new URL(req.url);const slug=searchParams.get('slug')||'';const token=req.headers.get('x-laruhp-analytics')||'';
  if(!slug||slug.length>160||!verifyAnalyticsSite(slug,token))return NextResponse.json({error:'Invalid request'},{status:400});
  let events;try{events=parseHeatmapEvents(await readAnalyticsJson(req));}catch{return NextResponse.json({error:'Invalid body'},{status:400});}
  const db=createServiceClient();
  const rate=await claimPublicRate(db,'heatmap',`${slug}:${clientIp(req)}`,120);
  if(rate==='limited')return NextResponse.json({error:'Too many requests'},{status:429});
  if(rate==='unavailable')return NextResponse.json({error:'Analytics unavailable'},{status:503});
  const site=await db.from('sites').select('id').eq('slug',slug).eq('published',true).single();
  if(site.error||!site.data)return NextResponse.json({error:'Site not found'},{status:404});
  const now=new Date().toISOString();const saved=await db.from('heatmap_events').insert(events.map(e=>({site_id:site.data.id,...e,created_at:now})));
  if(saved.error)return NextResponse.json({error:'Analytics unavailable'},{status:503});
  return NextResponse.json({ok:true});
}

export async function GET(req:Request){
  const auth=await createClient();const {data:{user}}=await auth.auth.getUser();if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  const {searchParams}=new URL(req.url);const siteId=searchParams.get('siteId');const path=searchParams.get('path')||'/';const type=searchParams.get('type')||'click';const device=searchParams.get('device')||'all';
  if(!siteId||!['click','scroll'].includes(type)||!['all','mobile','desktop'].includes(device)||!path.startsWith('/')||path.length>255)return NextResponse.json({error:'Invalid query'},{status:400});
  const owned=await auth.from('sites').select('id,slug').eq('id',siteId).eq('user_id',user.id).single();if(owned.error||!owned.data)return NextResponse.json({error:'Site not found'},{status:404});
  const service=createServiceClient();let query=service.from('heatmap_events').select('event_type,x,y,scroll_depth,viewport_w,viewport_h,session_id').eq('site_id',siteId).eq('path',path).eq('event_type',type).gte('created_at',new Date(Date.now()-30*86400000).toISOString()).order('created_at',{ascending:false}).limit(5000);
  if(device==='mobile')query=query.lt('viewport_w',768);if(device==='desktop')query=query.gte('viewport_w',768);
  const result=await query;if(result.error)return NextResponse.json({error:'Analytics unavailable'},{status:503});const events=result.data||[];
  if(type==='click'){
    const points=normalizeHeatmapClicks(events);
    const grid:Record<string,number>={};for(const p of points){const key=`${Math.floor(p.x/2)*2},${Math.floor(p.y/2)*2}`;grid[key]=(grid[key]||0)+1;}
    return NextResponse.json({type:'click',points,grid,total:points.length});
  }
  return NextResponse.json({type:'scroll',...aggregateScrollSessions(events)});
}
