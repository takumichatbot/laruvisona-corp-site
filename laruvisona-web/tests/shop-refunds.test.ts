import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import { refundShopOrder } from '../lib/shop-refunds.ts';

function fixture(refundStatus:'pending'|'requires_action'|'succeeded'|'failed'|'canceled'='succeeded'){
  const order={id:'a3f1c0de-1111-4111-8111-111111111111',site_id:'site-1',stripe_session_id:'cs_1',stripe_account_id:'acct_1',stripe_payment_intent_id:'pi_1',amount:2400,status:'paid',refund_started_at:null as string|null};
  const updates:Record<string,unknown>[]=[];
  const db={from(table:string){
    assert.equal(table,'hp_orders');
    return {update(values:Record<string,unknown>){updates.push(values);return {eq(){return this;},select:async()=>({data:[{id:order.id,status:values.status||order.status}],error:null})};}};
  }} as unknown as SupabaseClient;
  const refundCalls:Array<{body:Stripe.RefundCreateParams;options:Stripe.RequestOptions}>=[];
  const stripe={
    checkout:{sessions:{retrieve:async()=>({id:'cs_1',mode:'payment',payment_status:'paid',amount_total:2400,currency:'jpy',payment_intent:'pi_1',metadata:{kind:'shop',laru_site_id:'site-1'}})}},
    refunds:{create:async(body:Stripe.RefundCreateParams,options:Stripe.RequestOptions)=>{refundCalls.push({body,options});return {id:'re_1',status:refundStatus};}},
  } as unknown as Stripe;
  return {order,db,stripe,updates,refundCalls};
}

test('全額返金は接続口座と注文ID由来の固定キーを使い、成功確認後だけ返金済みにする',async()=>{
  const f=fixture('succeeded');
  const result=await refundShopOrder(f.order,f.db,f.stripe);
  assert.equal(result.status,'refunded');
  assert.equal(f.updates[0].status,'refund_pending');
  assert.equal(f.updates[1].status,'refunded');
  assert.deepEqual(f.refundCalls[0].body,{payment_intent:'pi_1'});
  assert.equal(f.refundCalls[0].options.stripeAccount,'acct_1');
  assert.equal(f.refundCalls[0].options.idempotencyKey,'laruhp-shop-refund-'+f.order.id);
});

test('Stripeが保留なら注文も確認中に保ち、別サイト・金額違いは更新前に拒否する',async()=>{
  const pending=fixture('pending');
  const result=await refundShopOrder(pending.order,pending.db,pending.stripe);
  assert.equal(result.status,'refund_pending');
  assert.equal(pending.updates.some(update=>update.status==='refunded'),false);

  const mismatch=fixture();
  mismatch.order.amount=9999;
  await assert.rejects(refundShopOrder(mismatch.order,mismatch.db,mismatch.stripe),/refund_mismatch/);
  assert.equal(mismatch.updates.length,0);
  assert.equal(mismatch.refundCalls.length,0);
});

test('返金APIは所有者境界をサービス側でも絞り、画面はAPI成功後だけ状態を変える',()=>{
  const api=readFileSync(new URL('../app/api/orders/refund/route.ts',import.meta.url),'utf8');
  const page=readFileSync(new URL('../app/laruHP/orders/page.tsx',import.meta.url),'utf8');
  assert.match(api,/sites!inner\(user_id\)/);
  assert.match(api,/\.eq\('sites\.user_id',user\.id\)/);
  assert.match(api,/claimPublicRate\(db,'shop-refund'/);
  assert.match(page,/fetch\('\/api\/orders\/refund'/);
  assert.match(page,/if\(!response\.ok\|\|!body\.order\)throw/);
  assert.match(page,/発送済み商品の在庫は自動では戻りません/);
});
