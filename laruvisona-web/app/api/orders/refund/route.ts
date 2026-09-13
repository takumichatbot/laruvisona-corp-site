import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { validOrderId } from '@/lib/order-contract';
import { readContactBody } from '@/lib/contact-contract';
import { rateLimit } from '@/lib/rate-limit';
import { getStripe } from '@/lib/stripe';
import { refundShopOrder } from '@/lib/shop-refunds';

export async function POST(req:Request){
  const auth=await createClient();
  const {data:{user}}=await auth.auth.getUser();
  if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  let id='';
  try{id=String((await readContactBody(req,10_000) as {id?:unknown}).id||'');}catch{return NextResponse.json({error:'注文を確認してください'},{status:400});}
  if(!validOrderId(id))return NextResponse.json({error:'注文を確認してください'},{status:400});
  if(!rateLimit(`shop-refund:${user.id}`,10,60_000).ok)return NextResponse.json({error:'少し待ってからお試しください'},{status:429});
  const db=createServiceClient();
  const found=await db.from('hp_orders').select('id,site_id,stripe_session_id,stripe_account_id,stripe_payment_intent_id,amount,status,refund_started_at,sites!inner(user_id)').eq('id',id).eq('sites.user_id',user.id).maybeSingle();
  if(found.error)return NextResponse.json({error:'注文情報を確認できませんでした'},{status:503});
  if(!found.data)return NextResponse.json({error:'注文が見つかりません'},{status:404});
  try{return NextResponse.json({order:await refundShopOrder(found.data,db,getStripe())});}
  catch(error){
    const message=(error as Error).message;
    if(message==='refund_state')return NextResponse.json({error:'この注文は返金できない状態です'},{status:409});
    if(message==='refund_conflict')return NextResponse.json({error:'別の画面で変更されました。読み直してください'},{status:409});
    return NextResponse.json({error:'返金を完了できませんでした。状態を確認して再度お試しください'},{status:503});
  }
}
