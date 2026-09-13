import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { parsePageview, readAnalyticsJson } from '@/lib/analytics-contract';
import { clientIp } from '@/lib/rate-limit';
import { claimPublicRate } from '@/lib/public-rate-limit';

export async function POST(req:Request){
  let input:{slug:string};
  try{input=parsePageview(await readAnalyticsJson(req,2048));}catch{return NextResponse.json({error:'Invalid request'},{status:400});}
  const db=createServiceClient();
  const rate=await claimPublicRate(db,'pageview',`${input.slug}:${clientIp(req)}`,120);
  if(rate==='limited')return NextResponse.json({error:'Too many requests'},{status:429});
  if(rate==='unavailable')return NextResponse.json({error:'Analytics unavailable'},{status:503});
  const result=await db.rpc('increment_view_count',{site_slug:input.slug});
  if(result.error)return NextResponse.json({error:'Analytics unavailable'},{status:503});
  return NextResponse.json({ok:true});
}
