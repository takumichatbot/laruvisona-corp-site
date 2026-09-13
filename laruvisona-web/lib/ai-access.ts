import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { hasFeature } from './plan-limits';

export async function requireAiAccess(
  db:SupabaseClient,
  userId:string,
  scope:string,
  hourlyLimit:number,
):Promise<NextResponse|null>{
  const {data:profile,error}=await db.from('profiles')
    .select('plan,subscription_status').eq('id',userId).single();
  if(error||!profile||!hasFeature(profile.plan,'builder')||
    !['active','trialing'].includes(profile.subscription_status)){
    return NextResponse.json({error:'ご契約の状態を確認してください。'},{status:403});
  }
  const claim=await db.rpc('laruhp_ai_claim_usage',{p_scope:scope,p_limit:hourlyLimit});
  if(claim.error){
    return NextResponse.json({error:'AI利用回数を確認できません。少し時間をおいてください。'},{status:503});
  }
  if(claim.data!==true){
    return NextResponse.json({error:'この時間のAI利用回数に達しました。時間をおいてください。'},{status:429});
  }
  return null;
}

export async function readAiJson(req:Request,maxBytes=16000):Promise<
  {ok:true;data:Record<string,unknown>}|{ok:false;response:NextResponse}
>{
  const raw=await req.text();
  if(Buffer.byteLength(raw,'utf8')>maxBytes){
    return {ok:false,response:NextResponse.json({error:'入力が長すぎます。'},{status:413})};
  }
  try{
    const data=JSON.parse(raw);
    if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('invalid');
    return {ok:true,data};
  }catch{
    return {ok:false,response:NextResponse.json({error:'入力を確認してください。'},{status:400})};
  }
}
