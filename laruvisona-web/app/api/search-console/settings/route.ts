import { NextResponse } from 'next/server';
import { createClient,createServiceClient } from '@/lib/supabase/server';
import { googleAccessToken,readSearchConsoleSettings,searchConsoleSites } from '@/lib/search-console';

export async function PATCH(req:Request){
  const auth=await createClient();const {data:{user}}=await auth.auth.getUser();if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  let siteUrl:string;try{siteUrl=await readSearchConsoleSettings(req);}catch{return NextResponse.json({error:'Invalid request'},{status:400});}
  const service=createServiceClient();const profile=await service.from('profiles').select('google_refresh_token').eq('id',user.id).single();
  if(profile.error||!profile.data?.google_refresh_token)return NextResponse.json({error:'Google account is not connected'},{status:409});
  const access=await googleAccessToken(profile.data.google_refresh_token);if(!access.ok)return NextResponse.json({error:access.revoked?'Google connection expired':'Google is temporarily unavailable'},{status:access.revoked?409:503});
  let available:string[];try{available=await searchConsoleSites(access.token);}catch{return NextResponse.json({error:'Search Console is temporarily unavailable'},{status:503});}
  if(!available.includes(siteUrl))return NextResponse.json({error:'Property is not available to this account'},{status:400});
  const saved=await service.from('profiles').update({search_console_site_url:siteUrl}).eq('id',user.id).select('id');
  if(saved.error||saved.data?.length!==1)return NextResponse.json({error:'Could not save property'},{status:503});
  return NextResponse.json({ok:true});
}

export async function DELETE(){
  const auth=await createClient();const {data:{user}}=await auth.auth.getUser();if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  const saved=await createServiceClient().from('profiles').update({google_refresh_token:null,search_console_site_url:null}).eq('id',user.id).select('id');
  if(saved.error||saved.data?.length!==1)return NextResponse.json({error:'Could not disconnect'},{status:503});
  return NextResponse.json({ok:true});
}
