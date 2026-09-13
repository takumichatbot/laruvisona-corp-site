import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { parsePageview, readAnalyticsJson } from '@/lib/analytics-contract';
import { clientIp,rateLimit } from '@/lib/rate-limit';

export async function POST(req:Request){
  let input:{slug:string};
  try{input=parsePageview(await readAnalyticsJson(req,2048));}catch{return NextResponse.json({error:'Invalid request'},{status:400});}
  if(!rateLimit(`pageview:${input.slug}:${clientIp(req)}`,120,3600000).ok)return NextResponse.json({error:'Too many requests'},{status:429});
  const result=await createServiceClient().rpc('increment_view_count',{site_slug:input.slug});
  if(result.error)return NextResponse.json({error:'Analytics unavailable'},{status:503});
  return NextResponse.json({ok:true});
}
