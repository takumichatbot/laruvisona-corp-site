import { NextResponse } from 'next/server';
import { createClient,createServiceClient } from '@/lib/supabase/server';
import { googleAccessToken,searchConsoleSites } from '@/lib/search-console';

type GscRow={keys:string[];clicks:number;impressions:number;ctr:number;position:number};
async function jsonRows(response:Response){
  if(!response.ok)throw new Error(response.status===401?'google_unauthorized':'google_unavailable');const body=await response.json().catch(()=>null) as {rows?:unknown}|null;
  if(!body||body.rows!==undefined&&!Array.isArray(body.rows))throw new Error('google_malformed');return (body.rows||[]) as GscRow[];
}
export async function GET(){
  const auth=await createClient();const {data:{user}}=await auth.auth.getUser();if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  const service=createServiceClient();const profile=await service.from('profiles').select('google_refresh_token,search_console_site_url').eq('id',user.id).single();
  if(profile.error)return NextResponse.json({error:'Could not load connection'},{status:503});if(!profile.data?.google_refresh_token)return NextResponse.json({connected:false});
  const access=await googleAccessToken(profile.data.google_refresh_token);
  if(!access.ok){
    if(access.revoked){const cleared=await service.from('profiles').update({google_refresh_token:null,search_console_site_url:null}).eq('id',user.id).select('id');if(cleared.error||cleared.data?.length!==1)return NextResponse.json({error:'Could not update expired connection'},{status:503});return NextResponse.json({connected:false,revoked:true});}
    return NextResponse.json({error:'Google is temporarily unavailable'},{status:503});
  }
  let availableSites:string[];try{availableSites=await searchConsoleSites(access.token);}catch(error){
    if(error instanceof Error&&error.message==='google_unauthorized')return NextResponse.json({error:'Google authorization must be renewed'},{status:409});
    return NextResponse.json({error:'Search Console is temporarily unavailable'},{status:503});
  }
  const siteUrl=typeof profile.data.search_console_site_url==='string'?profile.data.search_console_site_url:null;
  if(!siteUrl)return NextResponse.json({connected:true,siteUrl:null,availableSites});
  if(!availableSites.includes(siteUrl))return NextResponse.json({connected:true,siteUrl:null,availableSites,propertyUnavailable:true});
  const end=new Date(),start=new Date(Date.now()-27*86400000),fmt=(d:Date)=>d.toISOString().slice(0,10),api=`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,headers={Authorization:`Bearer ${access.token}`,'Content-Type':'application/json'};
  const request=(dimensions:string[],rowLimit?:number)=>fetch(api,{method:'POST',headers,body:JSON.stringify({startDate:fmt(start),endDate:fmt(end),dimensions,...(rowLimit?{rowLimit}:{})}),signal:AbortSignal.timeout(12000)});
  let summary:GscRow[],dates:GscRow[],queries:GscRow[];try{[summary,dates,queries]=await Promise.all([request([]).then(jsonRows),request(['date'],28).then(jsonRows),request(['query'],5).then(jsonRows)]);}catch{return NextResponse.json({error:'Search Console data is temporarily unavailable'},{status:503});}
  const row=summary[0];return NextResponse.json({connected:true,siteUrl,availableSites,summary:{clicks:row?.clicks??0,impressions:row?.impressions??0,ctr:row?Math.round(row.ctr*1000)/10:0,position:row?Math.round(row.position*10)/10:0},dates:dates.filter(r=>Array.isArray(r.keys)&&typeof r.keys[0]==='string').map(r=>({date:r.keys[0],clicks:r.clicks,impressions:r.impressions})),topQueries:queries.filter(r=>Array.isArray(r.keys)&&typeof r.keys[0]==='string').map(r=>({query:r.keys[0],clicks:r.clicks,impressions:r.impressions,position:Math.round(r.position*10)/10}))});
}
