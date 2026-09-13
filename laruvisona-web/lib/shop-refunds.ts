import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';

type RefundableOrder = {
  id:string; site_id:string; stripe_session_id:string|null; stripe_account_id:string|null;
  stripe_payment_intent_id:string|null; amount:number; status:string; refund_started_at:string|null;
};

const refundable = new Set(['paid','review','shipped','completed','refund_review']);
const options = (accountId:string|null) => accountId ? {stripeAccount:accountId} : undefined;

async function setStatus(db:SupabaseClient,order:RefundableOrder,from:string,status:string,extra:Record<string,unknown>={}) {
  const result=await db.from('hp_orders').update({status,...extra}).eq('id',order.id).eq('site_id',order.site_id).eq('status',from).select('id,status');
  if(result.error)throw Error('refund_database');
  if(!result.data||result.data.length!==1)throw Error('refund_conflict');
  order.status=status;
  return result.data[0];
}

export async function refundShopOrder(order:RefundableOrder,db:SupabaseClient,stripe:Stripe) {
  if(!refundable.has(order.status)&&order.status!=='refund_pending')throw Error('refund_state');
  if(!order.stripe_session_id)throw Error('refund_missing');
  const stripeOptions=options(order.stripe_account_id);
  const session=await stripe.checkout.sessions.retrieve(order.stripe_session_id,{},stripeOptions);
  const intentId=typeof session.payment_intent==='string'?session.payment_intent:session.payment_intent?.id;
  if(session.mode!=='payment'||session.payment_status!=='paid'||session.metadata?.kind!=='shop'||session.metadata.laru_site_id!==order.site_id||session.amount_total!==order.amount||session.currency!=='jpy'||!intentId)throw Error('refund_mismatch');
  if(order.stripe_payment_intent_id&&order.stripe_payment_intent_id!==intentId)throw Error('refund_mismatch');
  if(order.status!=='refund_pending')await setStatus(db,order,order.status,'refund_pending',{refund_started_at:new Date().toISOString(),stripe_payment_intent_id:intentId});
  const refund=await stripe.refunds.create({payment_intent:intentId},{...stripeOptions,idempotencyKey:'laruhp-shop-refund-'+order.id});
  const next=refund.status==='succeeded'?'refunded':['failed','canceled'].includes(refund.status||'')?'refund_review':'refund_pending';
  if(next===order.status){
    const saved=await db.from('hp_orders').update({refund_id:refund.id}).eq('id',order.id).eq('status','refund_pending').select('id,status');
    if(saved.error||!saved.data||saved.data.length!==1)throw Error('refund_database');
    return saved.data[0];
  }
  return setStatus(db,order,'refund_pending',next,{refund_id:refund.id});
}

export async function syncShopRefund(refund:Stripe.Refund,accountId:string|null,db:SupabaseClient,stripe:Stripe) {
  const intentId=typeof refund.payment_intent==='string'?refund.payment_intent:refund.payment_intent?.id;
  if(!intentId)return null;
  let query=db.from('hp_orders').select('id,site_id,stripe_account_id,stripe_payment_intent_id,amount,status').eq('stripe_payment_intent_id',intentId);
  query=accountId?query.eq('stripe_account_id',accountId):query.is('stripe_account_id',null);
  const found=await query.maybeSingle();
  if(found.error)throw Error('refund_database');
  const order=found.data as RefundableOrder|null;
  if(!order||!['refund_pending','refund_review'].includes(order.status))return null;
  const intent=await stripe.paymentIntents.retrieve(intentId,{expand:['latest_charge']},options(accountId));
  const charge=typeof intent.latest_charge==='object'?intent.latest_charge:null;
  const fullyRefunded=!!charge?.refunded&&charge.amount_refunded===order.amount&&intent.currency==='jpy';
  const next=fullyRefunded?'refunded':['failed','canceled'].includes(refund.status||'')?'refund_review':order.status;
  if(next===order.status)return order;
  return setStatus(db,order,order.status,next,{refund_id:refund.id});
}
