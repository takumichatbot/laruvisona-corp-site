import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getStripe } from '@/lib/stripe';
import { createServiceClient } from '@/lib/supabase/server';
import { notifyAppointment } from './notify';
import { validatePaymentSession, type BookingPayment, type PaidAppointment } from './payment-contract';

export { bookingReturnUrl, validatePaymentSession } from './payment-contract';

export function paymentsAvailable() {
  return process.env.HP_BOOKING_PREPAY_ENABLED === '1' && !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
}
type Payment = BookingPayment;
const checked = <T>(r:{data:T;error:unknown}) => {if(r.error) throw Error('payment_database');return r.data;};

export function paymentService(
  db: SupabaseClient = createServiceClient(),
  stripe: Stripe = getStripe(),
  notify: typeof notifyAppointment = notifyAppointment,
) {
  const options = (p:Payment) => ({stripeAccount:p.account_id});
  async function read(siteId:string,id:string) {
    const p = checked(await db.from('hp_booking_payments').select('*').eq('site_id',siteId).eq('appointment_id',id).maybeSingle()) as Payment|null;
    if(!p)return null;
    const a=checked(await db.from('hp_appointments').select('*').eq('site_id',siteId).eq('id',id).single()) as PaidAppointment;
    return {p,a};
  }
  async function settle(p:Payment,state:string,amount:number|null=null,intent:string|null=p.intent_id) {
    return checked(await db.rpc('hp_payment_settle',{p_site:p.site_id,p_id:p.appointment_id,p_state:state,p_session:p.session_id,p_intent:intent,p_amount:amount})) as PaidAppointment;
  }
  async function session(p:Payment,a:PaidAppointment) {
    if(p.session_id)return stripe.checkout.sessions.retrieve(p.session_id,{},options(p));
    if(!p.attempted_at || !p.return_url)return null;
    // Stripe retains idempotency keys at least 24h; never create a new charge after this window.
    if(Date.now()-Date.parse(p.attempted_at)>23*3600000)throw Error('payment_manual_review');
    const s=await stripe.checkout.sessions.create({
      mode:'payment',payment_method_types:['card'],locale:'ja',
      expires_at:Math.floor(Date.parse(a.hold_until)/1000),
      client_reference_id:a.id,
      line_items:[{price_data:{currency:'jpy',unit_amount:a.price,product_data:{name:a.service_name}},quantity:1}],
      success_url:p.return_url+'?payment_return=1',cancel_url:p.return_url+'?payment_return=1',
      customer_email:a.email,
      metadata:{kind:'hp_scheduling',site_id:p.site_id,appointment_id:a.id},
      payment_intent_data:{metadata:{kind:'hp_scheduling',site_id:p.site_id,appointment_id:a.id}},
    },{...options(p),idempotencyKey:'hp-booking-checkout-'+a.id});
    validatePaymentSession(s,p,a);
    checked(await db.rpc('hp_payment_attach',{p_site:p.site_id,p_id:a.id,p_session:s.id}));
    p.session_id=s.id;
    return s;
  }
  async function refunds(p:Payment,a:PaidAppointment) {
    if(!p.intent_id)return a;
    const pi=await stripe.paymentIntents.retrieve(p.intent_id,{expand:['latest_charge']},options(p));
    if(pi.amount!==a.price||pi.currency!=='jpy'||pi.livemode!==p.livemode)throw Error('payment_mismatch');
    const charge=typeof pi.latest_charge==='object'?pi.latest_charge:null;
    if(charge?.refunded && charge.amount_refunded===a.price)return settle(p,'refunded',a.price);
    if(a.payment_status!=='refund_pending')return a;
    const rs=await stripe.refunds.list({payment_intent:p.intent_id,limit:100},options(p));
    if(rs.has_more)throw Error('payment_manual_review');
    if(rs.data.some(r=>['pending','requires_action'].includes(r.status||'')))return a;
    if(p.refund_id && rs.data.some(r=>r.id===p.refund_id&&['failed','canceled'].includes(r.status||'')))return settle(p,'review');
    if(p.refund_started_at && Date.now()-Date.parse(p.refund_started_at)>23*3600000)return settle(p,'review');
    if(!p.refund_started_at){
      checked(await db.from('hp_booking_payments').update({refund_started_at:new Date().toISOString()}).eq('appointment_id',a.id).is('refund_started_at',null));
    }
    // Omit amount to refund the remaining balance, including after a merchant's partial refund.
    const r=await stripe.refunds.create({payment_intent:p.intent_id},{...options(p),idempotencyKey:'hp-booking-refund-'+a.id});
    checked(await db.from('hp_booking_payments').update({refund_id:r.id}).eq('appointment_id',a.id));
    if(r.status==='failed'||r.status==='canceled')return settle(p,'review');
    if(r.status==='succeeded'){
      const latest=await stripe.paymentIntents.retrieve(p.intent_id,{expand:['latest_charge']},options(p));
      const c=typeof latest.latest_charge==='object'?latest.latest_charge:null;
      if(c?.refunded&&c.amount_refunded===a.price)return settle(p,'refunded',a.price);
    }
    return a;
  }
  async function reconcile(siteId:string,id:string,expire=false) {
    const found=await read(siteId,id);if(!found)return null;
    const {p}=found;let {a}=found;
    let s;
    try {s=await session(p,a);}
    catch(e) {
      if(e instanceof Error&&e.message==='payment_manual_review')return settle(p,'review');
      throw e;
    }
    if(!s){
      if(a.status==='pending_payment'&&Date.parse(a.hold_until)<=Date.now())return settle(p,'abandoned');
      return a;
    }
    validatePaymentSession(s,p,a);
    if(expire && s.status==='open'){
      try {s=await stripe.checkout.sessions.expire(s.id,{},options(p));}
      catch {s=await stripe.checkout.sessions.retrieve(s.id,{},options(p));}
      validatePaymentSession(s,p,a);
    }
    if(s.status==='complete' && s.payment_status==='paid'){
      const intent=typeof s.payment_intent==='string'?s.payment_intent:s.payment_intent?.id;
      if(!intent)throw Error('payment_mismatch');
      a=await settle(p,'paid',s.amount_total,intent);p.intent_id=intent;
    }else if(s.status==='expired')a=await settle(p,'expired');
    a=await refunds(p,a);
    if(['confirmed','canceled'].includes(a.status))await notify(siteId,id,a.revision);
    checked(await db.from('hp_booking_payments').update({last_checked_at:new Date().toISOString()}).eq('appointment_id',id));
    return a;
  }
  async function checkout(siteId:string,id:string,tokenHash:string,returnUrl:string) {
    if(!paymentsAvailable())throw Error('payment_unavailable');
    const ready=checked(await db.rpc('hp_payment_prepare',{p_site:siteId,p_id:id,p_token_hash:tokenHash,p_return:returnUrl}));
    const p=ready as Payment,a=ready.appointment as PaidAppointment;
    const account=await stripe.accounts.retrieve(p.account_id);
    if(!account.charges_enabled||!account.payouts_enabled)throw Error('payment_unavailable');
    const s=await session(p,a);
    if(!s || s.status!=='open' || !s.url){await reconcile(siteId,id);return {url:null};}
    return {url:s.url};
  }
  return {checkout,reconcile};
}
