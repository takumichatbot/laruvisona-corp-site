import { getStripe } from '@/lib/stripe';
import { createServiceClient } from '@/lib/supabase/server';
import { reply } from '@/lib/scheduling/server';
import { paymentService } from '@/lib/scheduling/payments';
import { merchantAccountEvent } from '@/lib/scheduling/merchant';
import type Stripe from 'stripe';
import { commitShopCheckout } from '@/lib/shop-webhook';
import { readRequestText } from '@/lib/contact-contract';
import { syncShopRefund } from '@/lib/shop-refunds';
import { configuredStripeMode, eventMatchesConfiguredMode } from '@/lib/stripe-mode';
export const dynamic='force-dynamic';
export async function POST(req:Request){
 const secret=process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
 if(!secret)return reply({error:'Webhook not configured'},503);
 let e:Stripe.Event;
 try{e=getStripe().webhooks.constructEvent(await readRequestText(req,1_000_000),req.headers.get('stripe-signature')||'',secret);}catch{return reply({error:'Invalid signature'},400);}
 /*
   こちらの口も、署名だけでなく**どの環境のイベントか**を見る。
   注文・返金・決済アカウントの状態を書き換えるので、
   テスト環境のイベントで本番の注文が動くと、売上の記録が壊れる。
   （2026-09-18、契約側で同じ穴が実害を出した）
   ⚠️ 400ではなく200。再送させ続けても直らない。
 */
 const mode=configuredStripeMode();
 if(!eventMatchesConfiguredMode(e.livemode,mode)){
  console.error('[scheduling-webhook] 環境が一致しないので何もしません',{type:e.type,eventLivemode:e.livemode,configured:mode});
  return reply({received:true,skipped:'mode_mismatch'});
 }
 if(!e.account)return reply({received:true});
 const db=createServiceClient();
 const accountUpdate=merchantAccountEvent(e);
 if(accountUpdate){
  const saved=await db.from('hp_payment_accounts').update({charges_enabled:accountUpdate.charges_enabled,payouts_enabled:accountUpdate.payouts_enabled,updated_at:new Date().toISOString()}).eq('account_id',accountUpdate.accountId);
  return saved.error?reply({error:'Database unavailable'},503):reply({received:true});
 }
 if(e.type==='checkout.session.completed'){
  const session=e.data.object as Stripe.Checkout.Session;
  if(session.metadata?.kind==='shop'){
   try{await commitShopCheckout(session,e.account,db,getStripe());return reply({received:true});}
   catch{return reply({error:'Shop order could not be saved'},503);}
  }
 }
 if(['refund.created','refund.updated','refund.failed'].includes(e.type)){
  try{if(await syncShopRefund(e.data.object as Stripe.Refund,e.account,db,getStripe()))return reply({received:true});}
  catch{return reply({error:'Shop refund could not be saved'},503);}
 }
 let query=db.from('hp_booking_payments').select('site_id,appointment_id').eq('account_id',e.account);
 if(e.type==='checkout.session.completed'||e.type==='checkout.session.expired'){
  const s=e.data.object as Stripe.Checkout.Session;
  if(s.metadata?.kind!=='hp_scheduling')return reply({received:true});
  // An event can arrive before attach persisted the session. Reconciliation uses the durable create key.
  query=query.eq('appointment_id',s.metadata.appointment_id||'').eq('site_id',s.metadata.site_id||'');
 }else if(e.type==='charge.refunded'){
  const c=e.data.object as Stripe.Charge;
  query=query.eq('intent_id',typeof c.payment_intent==='string'?c.payment_intent:'');
 }else if(['refund.updated','refund.failed','refund.created'].includes(e.type)){
  const r=e.data.object as Stripe.Refund;
  query=query.eq('intent_id',typeof r.payment_intent==='string'?r.payment_intent:'');
 }else return reply({received:true});
 const {data,error}=await query.maybeSingle();
 if(error)return reply({error:'Database unavailable'},503);
 if(!data)return reply({received:true});
 try{await paymentService().reconcile(data.site_id,data.appointment_id);return reply({received:true});}
 catch{return reply({error:'Payment reconciliation incomplete'},503);}
}
