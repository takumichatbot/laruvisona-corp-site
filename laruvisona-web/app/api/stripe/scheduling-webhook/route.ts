import { getStripe } from '@/lib/stripe';
import { createServiceClient } from '@/lib/supabase/server';
import { reply } from '@/lib/scheduling/server';
import { paymentService } from '@/lib/scheduling/payments';
import { merchantAccountEvent } from '@/lib/scheduling/merchant';
import type Stripe from 'stripe';
export const dynamic='force-dynamic';
export async function POST(req:Request){
 const secret=process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
 if(!secret)return reply({error:'Webhook not configured'},503);
 let e:Stripe.Event;
 try{e=getStripe().webhooks.constructEvent(await req.text(),req.headers.get('stripe-signature')||'',secret);}catch{return reply({error:'Invalid signature'},400);}
 if(!e.account)return reply({received:true});
 const db=createServiceClient();
 const accountUpdate=merchantAccountEvent(e);
 if(accountUpdate){
  const saved=await db.from('hp_payment_accounts').update({charges_enabled:accountUpdate.charges_enabled,payouts_enabled:accountUpdate.payouts_enabled,updated_at:new Date().toISOString()}).eq('account_id',accountUpdate.accountId);
  return saved.error?reply({error:'Database unavailable'},503):reply({received:true});
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
