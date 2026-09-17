import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { hasFeature } from './plan-limits';
import { readContactBody } from './contact-contract';

export async function requireAiAccess(
  db:SupabaseClient,
  userId:string,
  scope:string,
  hourlyLimit:number,
):Promise<NextResponse|null>{
  const denied=await requireBuilderAccess(db,userId);
  if(denied)return denied;
  return claimBuilderUsage(db,scope,hourlyLimit);
}

export async function requireBuilderAccess(
  db:SupabaseClient,
  userId:string,
):Promise<NextResponse|null>{
  const {data:profile,error}=await db.from('profiles')
    .select('plan,subscription_status').eq('id',userId).single();
  if(error||!profile)return NextResponse.json({error:'ご契約の状態を確認してください。'},{status:403});

  // 運営（管理者）は契約が無くても通す。公開処理（app/api/sites/[id]/publish）は
  // 以前から同じ扱いで、AI側だけ揃っていなかった。そのため運営が自分の画面で
  // AIの機能を一度も試せず、壊れていても気づけない状態だった。
  // 回数の上限（claimBuilderUsage）は管理者にも同じようにかかる。
  if(await isAdminUser(db,userId))return null;

  if(!hasFeature(profile.plan,'builder')||
    !['active','trialing'].includes(profile.subscription_status)){
    return NextResponse.json({error:'ご契約の状態を確認してください。'},{status:403});
  }
  return null;
}

/** 運営のメールアドレスかどうか。未設定なら常に false。 */
async function isAdminUser(db:SupabaseClient,userId:string):Promise<boolean>{
  const allowed=[process.env.ADMIN_EMAIL,process.env.NEXT_PUBLIC_ADMIN_EMAIL]
    .filter(Boolean).join(',')
    .split(',').map(value=>value.trim().toLowerCase()).filter(Boolean);
  if(!allowed.length)return false;
  try{
    const {data}=await db.auth.getUser();
    const email=(data?.user?.email||'').trim().toLowerCase();
    return !!email&&data?.user?.id===userId&&allowed.includes(email);
  }catch{return false;}
}

export async function claimBuilderUsage(
  db:SupabaseClient,
  scope:string,
  hourlyLimit:number,
):Promise<NextResponse|null>{
  const claim=await db.rpc('laruhp_ai_claim_usage',{p_scope:scope,p_limit:hourlyLimit});
  if(claim.error){
    return NextResponse.json({error:'利用回数を確認できません。少し時間をおいてください。'},{status:503});
  }
  if(claim.data!==true){
    return NextResponse.json({error:'この時間の利用回数に達しました。時間をおいてください。'},{status:429});
  }
  return null;
}

export async function readAiJson(req:Request,maxBytes=16000):Promise<
  {ok:true;data:Record<string,unknown>}|{ok:false;response:NextResponse}
>{
  try{
    const data=await readContactBody(req,maxBytes);
    return {ok:true,data};
  }catch(error){
    if(error instanceof Error&&error.message==='too_large'){
      return {ok:false,response:NextResponse.json({error:'入力が長すぎます。'},{status:413})};
    }
    return {ok:false,response:NextResponse.json({error:'入力を確認してください。'},{status:400})};
  }
}
