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

/**
 * 返金・キャンセルが済んだら、在庫を戻す。
 *
 * 在庫を減らす所（laruhp_shop_commit_order）はあったのに、
 * **戻す所がどこにも無かった。**
 *   ・店主が返金しても、公開ショップの在庫は減ったまま
 *   ・在庫1の商品なら「売り切れ」表示が続き、**売れる物が売れなくなる**
 *   ・店には売れていない在庫が残る
 *
 * 返金はステータスだけ見て進むので、数量のずれは棚と画面を突き合わせないと
 * 分からない。気づくのは「なぜか注文が来ない」と思ったあと、ずっと後。
 *
 * 戻せなくても返金は取り消さない。返金は済んでいるので、
 * ここで投げると「返金したのに失敗と出る」ほうの混乱になる。
 * ただし**黙らない。** 戻せなかったことは必ず記録に残す。
 */
async function restock(db:SupabaseClient,orderId:string,status:string) {
  if(status!=='refunded'&&status!=='canceled')return;
  /*
    ここは**何があっても投げない。**

    返金はもう済んでいる。ここで投げると、返金したのに画面には
    「返金に失敗しました」と出て、店主は同じ操作をもう一度試す。
    在庫が戻らないより、そちらのほうが混乱が大きい。

    投げうるもの: 関数がまだ無い（SQL未実行）、通信断、
    db が rpc を持たない作りで呼ばれた、など。
    どれも黙らずに記録に残す。
  */
  try{
    const r=await db.rpc('laruhp_shop_restock_order',{p_order_id:orderId});
    if(r.error){
      // 関数がまだ無い場合もここに来る（supabase/hp_orders_restock.sql を実行する）
      console.error('[shop] stock not restored:',orderId,r.error.message);
      return;
    }
    const d=r.data as {ok?:boolean;reason?:string;restored?:number}|null;
    if(!d||d.ok!==true)console.error('[shop] stock not restored:',orderId,d?.reason||'unknown');
  }catch(e){
    console.error('[shop] stock not restored:',orderId,(e as Error)?.message||'threw');
  }
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
    await restock(db,order.id,saved.data[0].status);
    return saved.data[0];
  }
  const done=await setStatus(db,order,'refund_pending',next,{refund_id:refund.id});
  await restock(db,order.id,next);
  return done;
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
  const synced=await setStatus(db,order,order.status,next,{refund_id:refund.id});
  await restock(db,order.id,next);
  return synced;
}
